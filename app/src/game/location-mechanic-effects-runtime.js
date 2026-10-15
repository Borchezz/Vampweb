import { locations, tasks } from "./data.js";
import { applyResourceDeltaToState } from "./gameplay-commands.js";
import {
  changeLocationMechanicValue,
  changeLocationShopStock,
  createLocationMechanicRuntimeState,
  LOCATION_MECHANIC_TYPES,
  resolveLocationMechanic,
  resolveLocationShopOffer,
  setLocationShopOfferLocked,
} from "./location-mechanics.js";
import { normalizeLocationThreshold } from "./location-mechanic-contract.js";
import { resolveEffectNumber } from "./effect-value.js";

const MAX_THRESHOLD_EFFECT_DEPTH = 32;

export function getLocationMechanicThresholds(mechanic) {
  return (Array.isArray(mechanic?.thresholds) ? mechanic.thresholds : []).map((threshold, index) => normalizeLocationThreshold(threshold, { id: `threshold-${index + 1}` }));
}

export function getLocationTaskEffects(targetState, locationId, taskId, outcome) {
  return targetState.locationMechanics?.taskEffects?.[locationId]?.[taskId]?.[outcome] || [];
}

export function isLocationTaskLocked(targetState, locationId, taskId) {
  return Boolean(targetState.locationMechanics?.taskLocks?.[locationId]?.[taskId]);
}

function ensureRuntimeState(targetState, locationId) {
  targetState.locationMechanics ||= createLocationMechanicRuntimeState();
  targetState.locationMechanics.taskLocks ||= {};
  targetState.locationMechanics.taskLocks[locationId] ||= {};
  targetState.locationMechanics.taskEffects ||= {};
  targetState.locationMechanics.taskEffects[locationId] ||= {};
  targetState.locationMechanics.triggeredThresholds ||= {};
  targetState.locationMechanics.activeThresholds ||= {};
}

function didCrossThreshold(threshold, previousValue, nextValue) {
  const crossedUp = previousValue < threshold.value && nextValue >= threshold.value;
  const crossedDown = previousValue > threshold.value && nextValue <= threshold.value;
  if (threshold.direction === "down") return crossedDown;
  if (threshold.direction === "both") return crossedUp || crossedDown;
  return crossedUp;
}

function createTransaction(transaction) {
  return transaction || { depth: 0, activeThresholds: new Set() };
}

function applyEffect(targetState, location, effect, transaction, reversible = false) {
  if (effect.type === "resource_delta") {
    const amount = resolveEffectNumber(effect.amount);
    applyResourceDeltaToState(targetState, { [effect.resource]: amount });
    return reversible ? () => applyResourceDeltaToState(targetState, { [effect.resource]: -amount }) : null;
  }
  if (effect.type === "task_lock") {
    ensureRuntimeState(targetState, location.id);
    const previous = targetState.locationMechanics.taskLocks[location.id][effect.taskId];
    targetState.locationMechanics.taskLocks[location.id][effect.taskId] = effect.locked;
    return reversible ? () => {
      if (previous === undefined) delete targetState.locationMechanics.taskLocks[location.id][effect.taskId];
      else targetState.locationMechanics.taskLocks[location.id][effect.taskId] = previous;
    } : null;
  }
  if (effect.type === "task_outcome_effect") {
    const task = tasks.find((item) => item.id === effect.taskId && item.locationId === location.id);
    if (!task) return;
    ensureRuntimeState(targetState, location.id);
    const target = (targetState.locationMechanics.taskEffects[location.id][task.id] ||= { success: [], failure: [] });
    const applied = structuredClone(effect.effect);
    target[effect.outcome].push(applied);
    return reversible ? () => {
      const index = target[effect.outcome].indexOf(applied);
      if (index >= 0) target[effect.outcome].splice(index, 1);
    } : null;
  }
  if (effect.type === "mechanic_value_delta") {
    const amount = resolveEffectNumber(effect.amount);
    changeLocationMechanicValueWithEffects(targetState, location.id, effect.mechanicId, amount, { transaction });
    return reversible ? () => changeLocationMechanicValueWithEffects(targetState, location.id, effect.mechanicId, -amount, { transaction }) : null;
  }
  const offerTarget = resolveLocationShopOffer(location, effect.shopId, effect.offerId);
  if (!offerTarget) return null;
  if (effect.type === "shop_stock_delta") {
    const amount = resolveEffectNumber(effect.amount);
    changeLocationShopStock(targetState, location.id, offerTarget.shopId, offerTarget.offerId, offerTarget.offer, amount);
    return reversible ? () => changeLocationShopStock(targetState, location.id, offerTarget.shopId, offerTarget.offerId, offerTarget.offer, -amount) : null;
  }
  if (effect.type === "shop_offer_lock") {
    const previous = targetState.locationMechanics?.shops?.[location.id]?.[offerTarget.shopId]?.sellOffers?.[offerTarget.offerId]?.locked ?? offerTarget.offer.locked;
    setLocationShopOfferLocked(targetState, location.id, offerTarget.shopId, offerTarget.offerId, offerTarget.offer, effect.locked);
    return reversible ? () => setLocationShopOfferLocked(targetState, location.id, offerTarget.shopId, offerTarget.offerId, offerTarget.offer, previous) : null;
  }
  return null;
}

export function applyLocationMechanicThresholdEffects(targetState, locationId, mechanicReference, previousValue, nextValue, options = {}) {
  const location = locations.find((item) => item.id === locationId);
  const target = resolveLocationMechanic(location, mechanicReference);
  if (!location || !target || previousValue === nextValue) return [];
  ensureRuntimeState(targetState, location.id);
  const transaction = createTransaction(options.transaction);
  if (transaction.depth >= MAX_THRESHOLD_EFFECT_DEPTH) throw new Error("Превышена максимальная глубина цепочки эффектов локации.");
  const triggered = [];
  getLocationMechanicThresholds(target.mechanic).forEach((threshold) => {
    const key = `${location.id}:${target.id}:${threshold.id}`;
    if (threshold.mode === "above") {
      const wasActive = previousValue > threshold.value;
      const isActive = nextValue > threshold.value;
      if (wasActive === isActive) return;
      if (isActive) {
        const reverts = threshold.effects.map((effect) => applyEffect(targetState, location, effect, transaction, true)).filter(Boolean);
        targetState.locationMechanics.activeThresholds[key] = reverts;
        triggered.push(threshold.id);
      } else {
        const reverts = targetState.locationMechanics.activeThresholds[key] || [];
        [...reverts].reverse().forEach((revert) => revert());
        delete targetState.locationMechanics.activeThresholds[key];
      }
      return;
    }
    if (!didCrossThreshold(threshold, previousValue, nextValue)) return;
    if (threshold.repeat === "once" && targetState.locationMechanics.triggeredThresholds[key]) return;
    if (transaction.activeThresholds.has(key)) return;
    if (threshold.repeat === "once") targetState.locationMechanics.triggeredThresholds[key] = true;
    transaction.activeThresholds.add(key);
    transaction.depth += 1;
    try {
      threshold.effects.forEach((effect) => applyEffect(targetState, location, effect, transaction));
      triggered.push(threshold.id);
    } finally {
      transaction.depth -= 1;
      transaction.activeThresholds.delete(key);
    }
  });
  return triggered;
}

export function changeLocationMechanicValueWithEffects(targetState, locationId, mechanicReference, amount, options = {}) {
  const location = locations.find((item) => item.id === locationId);
  const target = resolveLocationMechanic(location, mechanicReference);
  if (!target || ![LOCATION_MECHANIC_TYPES.counter, LOCATION_MECHANIC_TYPES.scale].includes(target.mechanic.type)) return null;
  const bucket = target.mechanic.type === LOCATION_MECHANIC_TYPES.counter ? "counters" : "scales";
  const previous = targetState.locationMechanics?.[bucket]?.[locationId]?.[target.id] ?? (Number(target.mechanic.value) || 0);
  const next = changeLocationMechanicValue(targetState, locationId, target.mechanic.type, target.id, target.mechanic, amount);
  applyLocationMechanicThresholdEffects(targetState, locationId, target.id, previous, next, options);
  return { previous, next, mechanic: target.mechanic };
}
