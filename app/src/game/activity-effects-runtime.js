import { adjustAgentFatigue } from "./agent-parameters.js";
import { normalizeActivityEffectList } from "./activity-effect-registry.js";
import { applyResourceDelta, adjustSympathy } from "./rules.js";
import { getAgentMaxEnergy, getAgentOvertimeMax } from "./trait-effects-runtime.js";
import { grantAgentStatus } from "./status-effects-runtime.js";
import { resolveEffectNumber } from "./effect-value.js";

function amount(effect) {
  return resolveEffectNumber(effect.amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyAgentParameterDelta(agent, effect) {
  if (!agent) return;
  const delta = amount(effect);
  if (effect.parameter === "energy") agent.energy = clamp((Number(agent.energy) || 0) + delta, 0, getAgentMaxEnergy(agent));
  if (effect.parameter === "recovery") agent.baseRecovery = Math.max(0, (Number(agent.baseRecovery) || 0) + delta);
  if (effect.parameter === "sympathy") adjustSympathy(agent, delta);
  if (effect.parameter === "overtime") agent.overtimeLeft = clamp((Number(agent.overtimeLeft) || 0) + delta, 0, getAgentOvertimeMax(agent));
  if (effect.parameter === "fatigue") adjustAgentFatigue(agent, delta);
}

function getTargets(effect, { mainAgent, partnerAgent, agents }) {
  if (effect.target === "partner") return partnerAgent ? [partnerAgent] : [];
  if (effect.target === "all") return Array.isArray(agents) ? agents : [];
  return mainAgent ? [mainAgent] : [];
}

// This is deliberately not wired into a game action yet. It is the shared executor for the future activities UI.
export function applyActivityEffects(activity, context = {}) {
  normalizeActivityEffectList(activity?.effects).forEach((effect) => {
    if (effect.type === "resource_delta") applyResourceDelta({ [effect.resource]: amount(effect) });
    if (effect.type === "agent_parameter_delta") getTargets(effect, context).forEach((agent) => applyAgentParameterDelta(agent, effect));
    if (effect.type === "grant_status") getTargets(effect, context).forEach((agent) => grantAgentStatus(agent, effect.statusId, effect.stacks));
  });
}
