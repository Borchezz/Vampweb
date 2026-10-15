import { buyUpgrade, grantFreeUpgrade } from "./action-upgrades-favors.js";
import { adjustAgentFatigue } from "./agent-parameters.js";
import { adjustSympathy } from "./rules.js";
import { normalizeTaskEffectList } from "./task-effect-registry.js";
import { getAgentMaxEnergy, getAgentOvertimeMax } from "./trait-effects-runtime.js";
import { grantAgentStatus } from "./status-effects-runtime.js";
import { changeLocationShopStock, LOCATION_MECHANIC_TYPES, resolveLocationMechanic, resolveLocationShopOffer, setLocationShopOfferLocked } from "./location-mechanics.js";
import { changeLocationMechanicValueWithEffects, getLocationTaskEffects } from "./location-mechanic-effects-runtime.js";
import { state } from "./state.js";
import { resolveEffectNumber } from "./effect-value.js";

function cloneResourceMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function addDelta(target, delta) {
  Object.entries(cloneResourceMap(delta)).forEach(([resource, amount]) => {
    const numberAmount = Number(amount);
    if (!Number.isFinite(numberAmount) || numberAmount === 0) return;
    target[resource] = (target[resource] || 0) + numberAmount;
  });
  return target;
}

function getEffectAmount(effect, field, fallback = 0) {
  return resolveEffectNumber(effect[field], fallback);
}

function resolveTaskEffectDelta(effect) {
  switch (effect.type) {
    case "resource_delta":
      return { [effect.resource]: getEffectAmount(effect, "amount") };
    default:
      return {};
  }
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyAgentParameterDelta(agent, effect) {
  if (!agent) return;
  const amount = getEffectAmount(effect, "amount");
  switch (effect.parameter) {
    case "energy":
      agent.energy = clampValue((Number(agent.energy) || 0) + amount, 0, getAgentMaxEnergy(agent));
      break;
    case "recovery":
      agent.baseRecovery = Math.max(0, (Number(agent.baseRecovery) || 0) + amount);
      break;
    case "sympathy":
      adjustSympathy(agent, amount);
      break;
    case "overtime":
      agent.overtimeLeft = clampValue((Number(agent.overtimeLeft) || 0) + amount, 0, getAgentOvertimeMax(agent));
      break;
    case "fatigue":
      adjustAgentFatigue(agent, amount);
      break;
    default:
      break;
  }
}

function applyUpgradeGrant(effect) {
  const upgradeId = String(effect.upgradeId || "any").trim();
  if (!upgradeId || upgradeId === "any") {
    grantFreeUpgrade();
    return;
  }
  buyUpgrade(upgradeId, true);
}

function getTaskLocationMechanic(effect, context, type, field) {
  const location = context.location;
  const target = resolveLocationMechanic(location, effect[field], type);
  return target ? { location, ...target } : null;
}

function getTaskShopOffer(effect, context) {
  return resolveLocationShopOffer(context.location, effect.shopId, effect.offerId);
}

function applyTaskEffect(effect, context = {}) {
  switch (effect.type) {
    case "agent_parameter_delta":
      applyAgentParameterDelta(context.agent, effect);
      break;
    case "grant_upgrade":
      applyUpgradeGrant(effect);
      break;
    case "grant_status":
      grantAgentStatus(context.agent, effect.statusId, effect.stacks);
      break;
    case "location_counter_increase": {
      const target = getTaskLocationMechanic(effect, context, LOCATION_MECHANIC_TYPES.counter, "counterId");
      if (target) changeLocationMechanicValueWithEffects(state, target.location.id, target.id, getEffectAmount(effect, "amount"));
      break;
    }
    case "location_scale_decrease": {
      const target = getTaskLocationMechanic(effect, context, LOCATION_MECHANIC_TYPES.scale, "scaleId");
      if (target) changeLocationMechanicValueWithEffects(state, target.location.id, target.id, getEffectAmount(effect, "amount"));
      break;
    }
    case "location_shop_stock_increase": {
      const target = getTaskShopOffer(effect, context);
      if (target) changeLocationShopStock(state, context.location.id, target.shopId, target.offerId, target.offer, getEffectAmount(effect, "amount"));
      break;
    }
    case "location_shop_offer_lock": {
      const target = getTaskShopOffer(effect, context);
      if (target) setLocationShopOfferLocked(state, context.location.id, target.shopId, target.offerId, target.offer, effect.locked);
      break;
    }
    default:
      break;
  }
}

function resolveEffectListDelta(effects, context = {}) {
  return normalizeTaskEffectList(effects).reduce((delta, effect) => addDelta(delta, resolveTaskEffectDelta(effect, context)), {});
}

export function getTaskCost(task) {
  return addDelta(cloneResourceMap(task.costResources), resolveEffectListDelta(task.costEffects, { task }));
}

export function getTaskReward(task) {
  return addDelta(cloneResourceMap(task.rewards), resolveEffectListDelta(task.rewardEffects, { task }));
}

export function resolveTaskOutcomeDelta(task, outcome, context = {}) {
  const field = outcome === "success" ? "success" : "failure";
  const effectField = outcome === "success" ? "successEffects" : "failureEffects";
  const locationEffects = getLocationTaskEffects(state, context.location?.id || task.locationId, task.id, outcome);
  return addDelta(cloneResourceMap(task[field]), resolveEffectListDelta([...task[effectField], ...locationEffects], context));
}

export function applyTaskOutcomeEffects(task, outcome, context = {}) {
  const effectField = outcome === "success" ? "successEffects" : "failureEffects";
  const locationEffects = getLocationTaskEffects(state, context.location?.id || task.locationId, task.id, outcome);
  normalizeTaskEffectList([...task[effectField], ...locationEffects]).forEach((effect) => applyTaskEffect(effect, context));
}
