import { normalizeLocationMechanicEffectList, collectLocationMechanicEffectListSchemaErrors } from "./location-mechanic-effect-registry.js";
import { STANDARD_RESOURCE_IDS } from "./resource-catalog.js";
import { stabilizeTaskEffectLocationReferences } from "./task-effect-registry.js";

export const LOCATION_MECHANIC_TYPES = Object.freeze({
  counter: "counter",
  scale: "scale",
  shop: "shop",
});

export const LOCATION_THRESHOLD_DIRECTIONS = Object.freeze(["up", "down", "both"]);
export const LOCATION_THRESHOLD_REPEAT_POLICIES = Object.freeze(["once", "each_crossing"]);
export const LOCATION_THRESHOLD_MODES = Object.freeze(["crossing", "above"]);

export const LOCATION_THRESHOLD_DIRECTION_OPTIONS = Object.freeze([
  { value: "up", label: "При росте" },
  { value: "down", label: "При снижении" },
  { value: "both", label: "В обоих направлениях" },
]);

export const LOCATION_THRESHOLD_REPEAT_OPTIONS = Object.freeze([
  { value: "once", label: "Один раз" },
  { value: "each_crossing", label: "При каждом пересечении" },
]);

export const LOCATION_THRESHOLD_MODE_OPTIONS = Object.freeze([
  { value: "crossing", label: "При пересечении" },
  { value: "above", label: "Активен выше порога" },
]);

function integer(value, fallback = 0) {
  const numeric = Math.trunc(Number(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function slug(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function uniqueId(preferred, fallback, usedIds) {
  const base = slug(preferred, fallback);
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`;
  usedIds.add(candidate);
  return candidate;
}

export function createLocationMechanicId(type, mechanics = []) {
  return uniqueId(type, "mechanic", new Set(mechanics.map((mechanic) => mechanic?.id).filter(Boolean)));
}

export function createLocationThresholdId(mechanic = {}) {
  return uniqueId("threshold", "threshold", new Set((mechanic.thresholds || []).map((threshold) => threshold?.id).filter(Boolean)));
}

export function createLocationOfferId(mechanic = {}) {
  const offers = [...(mechanic.sellOffers || []), ...(mechanic.buyOffers || [])];
  return uniqueId("offer", "offer", new Set(offers.map((offer) => offer?.id).filter(Boolean)));
}

export function normalizeLocationThreshold(threshold, options = {}) {
  const source = threshold && typeof threshold === "object" && !Array.isArray(threshold) ? threshold : { value: threshold };
  const value = integer(source.value, options.fallbackValue ?? 0);
  return {
    id: String(source.id || options.id || "threshold"),
    value,
    direction: LOCATION_THRESHOLD_DIRECTIONS.includes(source.direction) ? source.direction : "up",
    repeat: LOCATION_THRESHOLD_REPEAT_POLICIES.includes(source.repeat) ? source.repeat : "once",
    mode: LOCATION_THRESHOLD_MODES.includes(source.mode) ? source.mode : "crossing",
    effects: normalizeLocationMechanicEffectList(source.effects),
  };
}

function normalizeThresholds(mechanic, min, max) {
  const usedIds = new Set();
  return (Array.isArray(mechanic.thresholds) ? mechanic.thresholds : [])
    .map((threshold, index) => {
      const normalized = normalizeLocationThreshold(threshold, { id: `threshold-${index + 1}`, fallbackValue: min });
      normalized.id = uniqueId(normalized.id, `threshold-${index + 1}`, usedIds);
      normalized.value = Math.min(max, Math.max(min, normalized.value));
      return normalized;
    })
    .sort((left, right) => left.value - right.value);
}

export function normalizeLocationCounterMechanic(mechanic = {}, options = {}) {
  const segments = Math.max(1, integer(mechanic.segments, 4));
  return {
    id: String(mechanic.id || options.id || "counter"),
    type: LOCATION_MECHANIC_TYPES.counter,
    name: String(mechanic.name || "Счётчик"),
    counterType: ["fillable", "self_filling", "decaying", "fillable_decaying"].includes(mechanic.counterType) ? mechanic.counterType : "fillable",
    segments,
    value: Math.min(segments, Math.max(0, integer(mechanic.value, 0))),
    thresholds: normalizeThresholds(mechanic, 0, segments),
  };
}

export function normalizeLocationScaleMechanic(mechanic = {}, options = {}) {
  let min = integer(mechanic.min, -100);
  let max = integer(mechanic.max, 100);
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return {
    id: String(mechanic.id || options.id || "scale"),
    type: LOCATION_MECHANIC_TYPES.scale,
    name: String(mechanic.name || "Шкала"),
    min,
    max,
    value: Math.min(max, Math.max(min, integer(mechanic.value, min))),
    thresholds: normalizeThresholds(mechanic, min, max),
  };
}

function normalizeShopOffer(offer = {}, options = {}) {
  const resource = STANDARD_RESOURCE_IDS.includes(offer.resource) && offer.resource !== "money" ? offer.resource : "bloodTier1";
  return {
    id: String(offer.id || options.id || "offer"),
    resource,
    price: Math.max(1, integer(offer.price, 1)),
    maxStock: Math.max(0, integer(offer.maxStock, 1)),
    refill: ["none", "daily", "weekly"].includes(offer.refill) ? offer.refill : "none",
    locked: Boolean(offer.locked),
  };
}

export function normalizeLocationShopMechanic(mechanic = {}, options = {}) {
  const usedIds = new Set();
  const normalizeOffers = (offers, prefix) => (Array.isArray(offers) ? offers : []).map((offer, index) => {
    const normalized = normalizeShopOffer(offer, { id: `${prefix}-${index + 1}` });
    normalized.id = uniqueId(normalized.id, `${prefix}-${index + 1}`, usedIds);
    return normalized;
  });
  return {
    id: String(mechanic.id || options.id || "shop"),
    type: LOCATION_MECHANIC_TYPES.shop,
    name: String(mechanic.name || "Магазин"),
    sellOffers: normalizeOffers(mechanic.sellOffers, "sell-offer"),
    buyOffers: normalizeOffers(mechanic.buyOffers, "buy-offer"),
  };
}

export function normalizeLocationMechanics(mechanics) {
  const usedIds = new Set();
  const normalized = (Array.isArray(mechanics) ? mechanics : []).flatMap((mechanic, index) => {
    if (!Object.values(LOCATION_MECHANIC_TYPES).includes(mechanic?.type)) return [];
    const id = uniqueId(mechanic.id, `${mechanic.type}-${index + 1}`, usedIds);
    if (mechanic.type === LOCATION_MECHANIC_TYPES.scale) return [normalizeLocationScaleMechanic(mechanic, { id })];
    if (mechanic.type === LOCATION_MECHANIC_TYPES.shop) return [normalizeLocationShopMechanic(mechanic, { id })];
    return [normalizeLocationCounterMechanic(mechanic, { id })];
  });
  const shops = normalized.filter((mechanic) => mechanic.type === LOCATION_MECHANIC_TYPES.shop);
  normalized.forEach((mechanic) => (mechanic.thresholds || []).forEach((threshold) => threshold.effects.forEach((effect) => {
    if (Object.hasOwn(effect, "mechanicId")) {
      const target = normalized.find((item) => item.id === effect.mechanicId) || normalized[Number(effect.mechanicId)];
      effect.mechanicId = target?.id || effect.mechanicId;
    }
    if (Object.hasOwn(effect, "shopId")) {
      const shop = shops.find((item) => item.id === effect.shopId) || shops[Number(effect.shopId)];
      effect.shopId = shop?.id || effect.shopId;
      const offer = shop?.sellOffers?.find((item) => item.id === effect.offerId) || shop?.sellOffers?.[Number(effect.offerId)];
      effect.offerId = offer?.id || effect.offerId;
    }
    if (effect.type === "task_outcome_effect") effect.effect = stabilizeTaskEffectLocationReferences(effect.effect, { mechanics: normalized });
  })));
  return normalized;
}

export function createLocationMechanic(type, mechanics = []) {
  const id = createLocationMechanicId(type, mechanics);
  if (type === LOCATION_MECHANIC_TYPES.scale) return normalizeLocationScaleMechanic({ id, name: "Новая шкала", min: -100, max: 100, value: 0 });
  if (type === LOCATION_MECHANIC_TYPES.shop) return normalizeLocationShopMechanic({ id, name: "Магазин" });
  return normalizeLocationCounterMechanic({ id, name: "Новый счётчик", counterType: "fillable", segments: 4, value: 0 });
}

export function collectLocationMechanicSchemaErrors(mechanic, context = "location mechanic") {
  if (!mechanic || typeof mechanic !== "object" || Array.isArray(mechanic)) return [`${context} must be a plain object`];
  const errors = [];
  if (!Object.values(LOCATION_MECHANIC_TYPES).includes(mechanic.type)) errors.push(`${context}.type must be counter, scale, or shop`);
  if (typeof mechanic.id !== "string" || !mechanic.id.trim()) errors.push(`${context}.id must be a non-empty string`);
  if (typeof mechanic.name !== "string" || !mechanic.name.trim()) errors.push(`${context}.name must be a non-empty string`);
  if (mechanic.type === LOCATION_MECHANIC_TYPES.shop) {
    ["sellOffers", "buyOffers"].forEach((field) => {
      if (!Array.isArray(mechanic[field])) errors.push(`${context}.${field} must be an array`);
      (Array.isArray(mechanic[field]) ? mechanic[field] : []).forEach((offer, index) => {
        if (typeof offer?.id !== "string" || !offer.id.trim()) errors.push(`${context}.${field}[${index}].id must be a non-empty string`);
      });
    });
    return errors;
  }
  if (!Number.isFinite(mechanic.value)) errors.push(`${context}.value must be a finite number`);
  if (!Array.isArray(mechanic.thresholds)) errors.push(`${context}.thresholds must be an array`);
  (Array.isArray(mechanic.thresholds) ? mechanic.thresholds : []).forEach((threshold, index) => {
    const thresholdContext = `${context}.thresholds[${index}]`;
    if (typeof threshold?.id !== "string" || !threshold.id.trim()) errors.push(`${thresholdContext}.id must be a non-empty string`);
    if (!Number.isFinite(threshold?.value)) errors.push(`${thresholdContext}.value must be a finite number`);
    if (!LOCATION_THRESHOLD_DIRECTIONS.includes(threshold?.direction)) errors.push(`${thresholdContext}.direction must be up, down, or both`);
    if (!LOCATION_THRESHOLD_REPEAT_POLICIES.includes(threshold?.repeat)) errors.push(`${thresholdContext}.repeat must be once or each_crossing`);
    if (threshold?.mode !== undefined && !LOCATION_THRESHOLD_MODES.includes(threshold.mode)) errors.push(`${thresholdContext}.mode must be crossing or above`);
    errors.push(...collectLocationMechanicEffectListSchemaErrors(threshold?.effects, `${thresholdContext}.effects`));
  });
  return errors;
}

export function collectLocationMechanicListSchemaErrors(mechanics, context = "location mechanics") {
  if (mechanics === undefined) return [];
  if (!Array.isArray(mechanics)) return [`${context} must be an array`];
  const errors = mechanics.flatMap((mechanic, index) => collectLocationMechanicSchemaErrors(mechanic, `${context}[${index}]`));
  const ids = mechanics.map((mechanic) => mechanic?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push(`${context} must have unique mechanic ids`);
  const mechanicIds = new Set(ids);
  const shops = new Map(mechanics.filter((mechanic) => mechanic?.type === LOCATION_MECHANIC_TYPES.shop).map((shop) => [shop.id, shop]));
  mechanics.forEach((mechanic, mechanicIndex) => {
    const thresholdIds = (mechanic?.thresholds || []).map((threshold) => threshold.id).filter(Boolean);
    if (new Set(thresholdIds).size !== thresholdIds.length) errors.push(`${context}[${mechanicIndex}].thresholds must have unique ids`);
    (mechanic?.thresholds || []).forEach((threshold, thresholdIndex) => (threshold.effects || []).forEach((effect, effectIndex) => {
      const effectContext = `${context}[${mechanicIndex}].thresholds[${thresholdIndex}].effects[${effectIndex}]`;
      if (effect.mechanicId && !mechanicIds.has(effect.mechanicId)) errors.push(`${effectContext}.mechanicId references unknown mechanic: ${effect.mechanicId}`);
      if (effect.shopId) {
        const shop = shops.get(effect.shopId);
        if (!shop) errors.push(`${effectContext}.shopId references unknown shop: ${effect.shopId}`);
        else if (effect.offerId && !shop.sellOffers?.some((offer) => offer.id === effect.offerId)) errors.push(`${effectContext}.offerId references unknown offer: ${effect.offerId}`);
      }
    }));
    if (mechanic?.type === LOCATION_MECHANIC_TYPES.shop) {
      const offerIds = [...(mechanic.sellOffers || []), ...(mechanic.buyOffers || [])].map((offer) => offer.id).filter(Boolean);
      if (new Set(offerIds).size !== offerIds.length) errors.push(`${context}[${mechanicIndex}] must have unique offer ids`);
    }
  });
  return errors;
}
