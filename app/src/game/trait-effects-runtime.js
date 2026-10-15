import { getActiveAgentTraits } from "./agent-traits.js";
import { getAgentFatigue, normalizeAgentFatigue } from "./agent-parameters.js";
import { isAgentSympathyEnabled } from "./agent-main-character.js";
import { normalizeTraitEffect } from "./trait-effect-registry.js";
import { getAgentStatusEffectAmount, getAgentStatusSpecialties } from "./status-effects-runtime.js";
import { resolveEffectNumber } from "./effect-value.js";

function toInteger(value, fallback = 0) {
  const numberValue = Math.trunc(Number(value));
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampNonNegative(value) {
  return Math.max(0, toInteger(value));
}

export function getAgentTraitEffects(agent, type = "") {
  return getActiveAgentTraits(agent)
    .flatMap((trait) => (Array.isArray(trait.effects) ? trait.effects : []))
    .map((effect) => normalizeTraitEffect(effect))
    .filter(Boolean)
    .filter((effect) => !type || effect.type === type);
}

export function getAgentTraitEffectAmount(agent, type, field = "amount") {
  return getAgentTraitEffects(agent, type).reduce((sum, effect) => sum + resolveEffectNumber(effect[field]), 0);
}

export function getAgentTraitParameterSources(agent, parameter) {
  const normalizedParameter = String(parameter || "").trim();
  return getActiveAgentTraits(agent).flatMap((trait) =>
    (Array.isArray(trait.effects) ? trait.effects : [])
      .map((effect) => normalizeTraitEffect(effect))
      .filter((effect) => effect?.type === "agent_parameter_delta" && effect.parameter === normalizedParameter)
      .map((effect) => ({ name: trait.name || trait.id, amount: resolveEffectNumber(effect.amount) }))
  );
}

export function getAgentParameterDelta(agent, parameter) {
  const normalizedParameter = String(parameter || "").trim();
  const traitAmount = getAgentTraitParameterSources(agent, normalizedParameter).reduce((sum, source) => sum + source.amount, 0);
  return traitAmount + getAgentStatusParameterDelta(agent, normalizedParameter);
}

function getAgentStatusParameterDelta(agent, parameter) {
  return getAgentStatusEffectAmount(agent, "agent_parameter_delta", "amount", parameter);
}

export function getAgentMaxEnergy(agent) {
  return clampNonNegative(toInteger(agent?.maxEnergy) + getAgentParameterDelta(agent, "energy"));
}

export function getAgentRecoveryModifier(agent) {
  return getAgentParameterDelta(agent, "recovery");
}

export function getAgentEffectiveSympathy(agent) {
  if (!isAgentSympathyEnabled(agent)) return 0;
  return toInteger(agent?.sympathy) + getAgentParameterDelta(agent, "sympathy");
}

export function getAgentOvertimeMax(agent) {
  return clampNonNegative(toInteger(agent?.overtimeMax) + getAgentParameterDelta(agent, "overtime"));
}

export function getAgentEffectiveFatigue(agent) {
  return normalizeAgentFatigue(getAgentFatigue(agent) + getAgentParameterDelta(agent, "fatigue"));
}

export function getAgentSympathyGainAmount(agent, amount) {
  const baseAmount = toInteger(amount);
  if (baseAmount <= 0) return baseAmount;
  const percent = getAgentTraitEffectAmount(agent, "sympathy_gain_percent", "percent") + getAgentStatusEffectAmount(agent, "sympathy_gain_percent", "percent");
  const multiplier = Math.max(0, 100 + percent) / 100;
  return Math.max(0, Math.round(baseAmount * multiplier));
}

export function getAgentDailyUpkeepCosts(agent) {
  return getAgentTraitEffects(agent, "upkeep_cost").reduce((costs, effect) => {
    const resource = String(effect.resource || "").trim();
    const amount = resolveEffectNumber(effect.amount);
    if (!resource || amount === 0) return costs;
    costs[resource] = (costs[resource] || 0) + amount;
    return costs;
  }, {});
}

export function getAgentSpecialtyStats(agent) {
  return [
    ...getAgentTraitEffects(agent, "specialization").map((effect) => effect.stat),
    ...getAgentStatusSpecialties(agent),
  ]
    .map((stat) => String(stat || "").trim())
    .filter((stat, index, stats) => stat && stat !== "none" && stats.indexOf(stat) === index);
}

export function hasAgentSpecialty(agent, stat) {
  const normalizedStat = String(stat || "").trim();
  return normalizedStat !== "none" && getAgentSpecialtyStats(agent).includes(normalizedStat);
}

export function getAgentMovementEnergyCost(agent, baseCost, pathId = "") {
  const cost = toFiniteNumber(baseCost);
  if (cost <= 0) return 0;
  const percent = getAgentTraitEffectAmount(agent, "movement_cost_percent", "percent") + getAgentStatusEffectAmount(agent, "movement_cost_percent", "percent");
  const delta =
    getAgentTraitEffectAmount(agent, "movement_cost_delta") +
    getAgentTraitEffects(agent, "path_energy_delta")
      .filter((effect) => effect.pathId === pathId)
      .reduce((sum, effect) => sum + resolveEffectNumber(effect.amount), 0);
  const multiplier = Math.max(0, 100 + percent) / 100;
  return Math.max(1, Math.round(cost * multiplier + delta));
}
