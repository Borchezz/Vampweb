import { locations, tasks } from "./data.js";
import { createDefaultLocationMechanicEffect, normalizeLocationMechanicEffect } from "./location-mechanic-effect-registry.js";
import { createLocationMechanic, createLocationOfferId, createLocationThresholdId } from "./location-mechanic-contract.js";
import { createDefaultTaskEffect, normalizeTaskEffect } from "./task-effect-registry.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";

function updateLocationMechanics(locationId, update) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;
  const mechanics = Array.isArray(location.mechanics) ? structuredClone(location.mechanics) : [];
  update(mechanics, location);
  location.mechanics = mechanics;
  recordEditorChange("location", locationId, "mechanics");
  saveEditorDraft(true);
  render();
}

function findMechanic(mechanics, element) {
  const id = element.dataset.locationMechanicId;
  return mechanics.find((mechanic) => mechanic.id === id) || mechanics[Number(element.dataset.locationMechanicIndex)];
}

function findThreshold(mechanic, element) {
  const id = element.dataset.locationThresholdId;
  return mechanic?.thresholds?.find((threshold) => threshold.id === id) || mechanic?.thresholds?.[Number(element.dataset.locationMechanicThreshold)];
}

function addContextDefaults(effect, location) {
  const shop = location.mechanics?.find((mechanic) => mechanic.type === "shop");
  const valueMechanic = location.mechanics?.find((mechanic) => mechanic.type !== "shop");
  const task = tasksForLocation(location.id)[0];
  if (Object.hasOwn(effect, "mechanicId") && !effect.mechanicId) effect.mechanicId = valueMechanic?.id || "";
  if (Object.hasOwn(effect, "shopId") && !effect.shopId) effect.shopId = shop?.id || "";
  if (Object.hasOwn(effect, "offerId") && !effect.offerId) effect.offerId = shop?.sellOffers?.[0]?.id || "";
  if (Object.hasOwn(effect, "taskId") && !effect.taskId) effect.taskId = task?.id || "";
  return effect;
}

function tasksForLocation(locationId) {
  return tasks.filter((task) => task.locationId === locationId);
}

export function handleLocationMechanicAdd(button) {
  updateLocationMechanics(button.dataset.locationMechanicAdd, (mechanics) => mechanics.push(createLocationMechanic(button.dataset.locationMechanicType, mechanics)));
}

export function handleLocationMechanicRemove(button) {
  updateLocationMechanics(button.dataset.locationMechanicLocation, (mechanics) => {
    const mechanic = findMechanic(mechanics, button);
    if (mechanic) mechanics.splice(mechanics.indexOf(mechanic), 1);
  });
}

export function handleLocationMechanicFieldChange(input) {
  const field = input.dataset.locationMechanicField || input.dataset.locationCounterField;
  updateLocationMechanics(input.dataset.locationMechanicLocation || input.dataset.locationCounterLocation, (mechanics) => {
    const mechanic = findMechanic(mechanics, input);
    if (!mechanic) return;
    mechanic[field] = ["segments", "min", "max", "value"].includes(field) ? Math.trunc(Number(input.value) || 0) : input.value;
  });
}

export function handleLocationMechanicAction(button) {
  const action = button.dataset.locationMechanicAction;
  updateLocationMechanics(button.dataset.locationMechanicLocation, (mechanics, location) => {
    const mechanic = findMechanic(mechanics, button);
    if (!mechanic) return;
    if (action === "threshold-add") {
      mechanic.thresholds ||= [];
      mechanic.thresholds.push({ id: createLocationThresholdId(mechanic), value: 0, direction: "up", repeat: "once", mode: "crossing", effects: [] });
    }
    if (action === "threshold-remove") {
      const threshold = findThreshold(mechanic, button);
      if (threshold) mechanic.thresholds.splice(mechanic.thresholds.indexOf(threshold), 1);
    }
    if (action === "offer-add") {
      const field = button.dataset.locationMechanicOfferType === "sell" ? "sellOffers" : "buyOffers";
      mechanic[field] ||= [];
      mechanic[field].push({ id: createLocationOfferId(mechanic), resource: "bloodTier1", price: 1, maxStock: 1, refill: "none", locked: false });
    }
    if (action === "offer-remove") {
      const field = button.dataset.locationMechanicOfferType === "sell" ? "sellOffers" : "buyOffers";
      const offer = mechanic[field]?.find((item) => item.id === button.dataset.locationOfferId) || mechanic[field]?.[Number(button.dataset.locationMechanicOffer)];
      if (offer) mechanic[field].splice(mechanic[field].indexOf(offer), 1);
    }
    if (action === "threshold-effect-add") {
      const threshold = findThreshold(mechanic, button);
      threshold?.effects.push(addContextDefaults(createDefaultLocationMechanicEffect(), location));
    }
    if (action === "threshold-effect-remove") {
      const threshold = findThreshold(mechanic, button);
      threshold?.effects.splice(Number(button.dataset.locationThresholdEffectIndex), 1);
    }
  });
}

export function handleLocationMechanicOfferFieldChange(input) {
  const field = input.dataset.locationMechanicOfferField;
  updateLocationMechanics(input.dataset.locationMechanicLocation, (mechanics) => {
    const mechanic = findMechanic(mechanics, input);
    const offerField = input.dataset.locationMechanicOfferType === "sell" ? "sellOffers" : "buyOffers";
    const offer = mechanic?.[offerField]?.find((item) => item.id === input.dataset.locationOfferId)
      || mechanic?.[offerField]?.[Number(input.dataset.locationMechanicOffer)];
    if (!offer) return;
    if (field === "locked") offer[field] = input.checked;
    else if (field === "price") offer[field] = Math.max(1, Math.trunc(Number(input.value) || 1));
    else if (field === "maxStock") offer[field] = Math.max(0, Math.trunc(Number(input.value) || 0));
    else offer[field] = input.value;
  });
}

export function handleLocationMechanicThresholdFieldChange(input) {
  updateLocationMechanics(input.dataset.locationMechanicLocation, (mechanics) => {
    const mechanic = findMechanic(mechanics, input);
    const threshold = findThreshold(mechanic, input);
    if (!threshold) return;
    const field = input.dataset.locationMechanicThresholdField || "value";
    threshold[field] = field === "value" ? Math.trunc(Number(input.value) || 0) : input.value;
  });
}

export function handleLocationThresholdEffectFieldChange(input) {
  updateLocationMechanics(input.dataset.locationMechanicLocation, (mechanics, location) => {
    const mechanic = findMechanic(mechanics, input);
    const threshold = findThreshold(mechanic, input);
    const effectIndex = Number(input.dataset.locationThresholdEffectIndex);
    const effect = threshold?.effects?.[effectIndex];
    if (!effect) return;
    const field = input.dataset.locationThresholdEffectField;
    if (field === "type") {
      threshold.effects[effectIndex] = addContextDefaults(createDefaultLocationMechanicEffect(input.value), location);
      return;
    }
    if (field === "effect.type") {
      effect.effect = createDefaultTaskEffect(input.value, { tasks: tasksForLocation(location.id) });
      return;
    }
    const nestedField = field?.startsWith("effect.") ? field.slice(7) : "";
    if (nestedField) {
      effect.effect = normalizeTaskEffect({ ...effect.effect, [nestedField]: input.type === "checkbox" ? input.checked : input.value });
      return;
    }
    effect[field] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    if (field === "shopId") {
      const shop = location.mechanics?.find((item) => item.id === effect.shopId);
      effect.offerId = shop?.sellOffers?.[0]?.id || "";
    }
    threshold.effects[effectIndex] = normalizeLocationMechanicEffect(effect);
  });
}
