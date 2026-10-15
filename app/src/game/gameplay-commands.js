import { adjustAgentFatigue } from "./agent-parameters.js";
import { state } from "./state.js";

export function canAfford(cost = {}) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

export function spendResources(cost = {}) {
  Object.entries(cost).forEach(([resource, amount]) => {
    state.resources[resource] -= amount;
  });
}

export function applyResourceDelta(delta = {}) {
  return applyResourceDeltaToState(state, delta);
}

export function applyResourceDeltaToState(targetState, delta = {}) {
  targetState.resources ||= {};
  Object.entries(delta).forEach(([resource, amount]) => {
    targetState.resources[resource] = (targetState.resources[resource] || 0) + amount;
    if (!["money", "debt"].includes(resource)) {
      targetState.resources[resource] = Math.max(0, targetState.resources[resource]);
    }
  });
}

export function addResourceCosts(...costs) {
  return costs.reduce((total, cost = {}) => {
    Object.entries(cost).forEach(([resource, amount]) => {
      total[resource] = (total[resource] || 0) + amount;
    });
    return total;
  }, {});
}

export function splitOutcomeDelta(delta = {}) {
  const resources = {};
  let fatigue = 0;

  Object.entries(delta || {}).forEach(([key, amount]) => {
    if (key === "fatigue") {
      const fatigueAmount = Math.trunc(Number(amount));
      if (Number.isFinite(fatigueAmount)) fatigue += fatigueAmount;
      return;
    }
    resources[key] = amount;
  });

  return { resources, fatigue };
}

export function applyOutcomeDelta(agent, delta = {}) {
  const outcome = splitOutcomeDelta(delta);
  applyResourceDelta(outcome.resources);
  if (outcome.fatigue !== 0) adjustAgentFatigue(agent, outcome.fatigue);
  return outcome;
}

export function spendResourcesWithAgentRefund(_agent, cost = {}) {
  spendResources(cost);
  return {};
}

export function rollOpportunityDice(_agent, rollDie) {
  const config = { dice: 2, keep: 2, sides: 6 };
  const rolls = Array.from({ length: config.dice }, () => rollDie(config.sides));
  const chosen = [...rolls].sort((a, b) => b - a).slice(0, config.keep);
  const total = chosen.reduce((sum, value) => sum + value, 0);
  return {
    ...config,
    rolls,
    chosen,
    total,
    tableScore: Math.min(12, Math.max(2, total)),
  };
}
