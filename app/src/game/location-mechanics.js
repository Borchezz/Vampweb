import {
  createLocationMechanic,
  LOCATION_MECHANIC_TYPES,
  normalizeLocationCounterMechanic,
  normalizeLocationScaleMechanic,
  normalizeLocationShopMechanic,
} from "./location-mechanic-contract.js";

export { createLocationMechanic, LOCATION_MECHANIC_TYPES };

function integer(value, fallback = 0) {
  const numeric = Math.trunc(Number(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeLocationScale(mechanic = {}) {
  return normalizeLocationScaleMechanic(mechanic);
}

export function normalizeLocationShop(mechanic = {}) {
  return normalizeLocationShopMechanic(mechanic);
}

export function getLocationMechanics(location, type) {
  const mechanics = Array.isArray(location?.mechanics) ? location.mechanics : [];
  return type ? mechanics.filter((mechanic) => mechanic?.type === type) : mechanics;
}

export function resolveLocationMechanic(location, reference, type) {
  const mechanics = getLocationMechanics(location);
  let index = mechanics.findIndex((mechanic) => mechanic.id === String(reference));
  if (index < 0 && Number.isInteger(Number(reference))) index = Number(reference);
  const mechanic = mechanics[index];
  return mechanic && (!type || mechanic.type === type) ? { mechanic, index, id: mechanic.id } : null;
}

export function resolveLocationShopOffer(location, shopReference, offerReference, kind = "sell") {
  const shopTarget = resolveLocationMechanic(location, shopReference, LOCATION_MECHANIC_TYPES.shop);
  if (!shopTarget) return null;
  const field = kind === "buy" ? "buyOffers" : "sellOffers";
  const offers = shopTarget.mechanic[field] || [];
  let offerIndex = offers.findIndex((offer) => offer.id === String(offerReference));
  if (offerIndex < 0 && Number.isInteger(Number(offerReference))) offerIndex = Number(offerReference);
  const offer = offers[offerIndex];
  return offer ? { shop: shopTarget.mechanic, shopIndex: shopTarget.index, shopId: shopTarget.id, offer, offerIndex, offerId: offer.id } : null;
}

export function getLocationScales(location, targetState) {
  return getLocationMechanics(location, LOCATION_MECHANIC_TYPES.scale).map((mechanic) => {
    const scale = normalizeLocationScale(mechanic);
    return { ...scale, value: getLocationMechanicValue(targetState, location.id, LOCATION_MECHANIC_TYPES.scale, scale.id, scale.value) };
  });
}

export function getLocationShops(location) {
  return getLocationMechanics(location, LOCATION_MECHANIC_TYPES.shop).map(normalizeLocationShop);
}

export function createLocationMechanicRuntimeState() {
  return { shops: {}, counters: {}, scales: {}, taskLocks: {}, taskEffects: {}, triggeredThresholds: {} };
}

export function initializeLocationMechanicState(targetState, locations = []) {
  targetState.locationMechanics = createLocationMechanicRuntimeState();
  locations.forEach((location) => {
    targetState.locationMechanics.counters[location.id] = {};
    targetState.locationMechanics.scales[location.id] = {};
    getLocationMechanics(location).forEach((mechanic) => {
      if (mechanic.type === LOCATION_MECHANIC_TYPES.counter) {
        const counter = normalizeLocationCounterMechanic(mechanic);
        targetState.locationMechanics.counters[location.id][counter.id] = counter.value;
      }
      if (mechanic.type === LOCATION_MECHANIC_TYPES.scale) {
        const scale = normalizeLocationScale(mechanic);
        targetState.locationMechanics.scales[location.id][scale.id] = scale.value;
      }
      if (mechanic.type === LOCATION_MECHANIC_TYPES.shop) {
        const shop = normalizeLocationShop(mechanic);
        targetState.locationMechanics.shops[location.id] ||= {};
        targetState.locationMechanics.shops[location.id][shop.id] = {
          sellOffers: Object.fromEntries(shop.sellOffers.map((offer) => [offer.id, { stock: offer.maxStock, locked: offer.locked }])),
        };
      }
    });
  });
}

export function getLocationMechanicValue(targetState, locationId, type, reference, fallback) {
  const bucket = type === LOCATION_MECHANIC_TYPES.counter ? "counters" : "scales";
  const value = targetState.locationMechanics?.[bucket]?.[locationId]?.[reference];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function changeLocationMechanicValue(targetState, locationId, type, reference, mechanic, amount) {
  const bucket = type === LOCATION_MECHANIC_TYPES.counter ? "counters" : "scales";
  targetState.locationMechanics ||= createLocationMechanicRuntimeState();
  targetState.locationMechanics[bucket] ||= {};
  targetState.locationMechanics[bucket][locationId] ||= {};
  const key = mechanic.id || String(reference);
  const current = getLocationMechanicValue(targetState, locationId, type, key, integer(mechanic.value, 0));
  const next = type === LOCATION_MECHANIC_TYPES.scale
    ? Math.min(normalizeLocationScale(mechanic).max, Math.max(normalizeLocationScale(mechanic).min, current + integer(amount)))
    : Math.max(0, Math.min(normalizeLocationCounterMechanic(mechanic).segments, current + integer(amount)));
  targetState.locationMechanics[bucket][locationId][key] = next;
  return next;
}

function getOfferState(targetState, locationId, shopId, offerId, offer) {
  return targetState.locationMechanics?.shops?.[locationId]?.[shopId]?.sellOffers?.[offerId] || { stock: offer.maxStock, locked: offer.locked };
}

export function getLocationShopOfferState(targetState, locationId, shopReference, offerReference, offer) {
  return getOfferState(targetState, locationId, shopReference, offerReference, offer);
}

function ensureOfferState(targetState, locationId, shopId, offerId, offer) {
  targetState.locationMechanics ||= createLocationMechanicRuntimeState();
  targetState.locationMechanics.shops ||= {};
  targetState.locationMechanics.shops[locationId] ||= {};
  targetState.locationMechanics.shops[locationId][shopId] ||= { sellOffers: {} };
  targetState.locationMechanics.shops[locationId][shopId].sellOffers ||= {};
  targetState.locationMechanics.shops[locationId][shopId].sellOffers[offerId] ||= { stock: offer.maxStock, locked: offer.locked };
  return targetState.locationMechanics.shops[locationId][shopId].sellOffers[offerId];
}

export function changeLocationShopStock(targetState, locationId, shopId, offerId, offer, amount) {
  const offerState = ensureOfferState(targetState, locationId, shopId, offerId, offer);
  offerState.stock = Math.max(0, Math.min(offer.maxStock, integer(offerState.stock, offer.maxStock) + integer(amount)));
  return offerState;
}

export function setLocationShopOfferLocked(targetState, locationId, shopId, offerId, offer, locked) {
  const offerState = ensureOfferState(targetState, locationId, shopId, offerId, offer);
  offerState.locked = Boolean(locked);
  return offerState;
}

export function restockLocationShops(targetState, locations, period) {
  locations.forEach((location) => getLocationShops(location).forEach((shop) => {
    shop.sellOffers.forEach((offer) => {
      if (offer.refill !== period) return;
      ensureOfferState(targetState, location.id, shop.id, offer.id, offer).stock = offer.maxStock;
    });
  }));
}
