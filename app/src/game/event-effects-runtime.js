import { adjustAgentFatigue } from "./agent-parameters.js";
import { adjustSympathy, applyResourceDelta } from "./rules.js";
import { state } from "./state.js";
import { normalizeEventEffectList } from "./event-effect-registry.js";
import { getAgentMaxEnergy, getAgentOvertimeMax } from "./trait-effects-runtime.js";
import { grantAgentStatus } from "./status-effects-runtime.js";
import { adjustPathEnergy, setPathEnabled } from "./path-runtime.js";
import { resolveEffectNumber } from "./effect-value.js";

function getEffectAmount(effect, field, fallback = 0) {
  return resolveEffectNumber(effect[field], fallback);
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

export function applyEventEffects(event) {
  const effects = normalizeEventEffectList(event.effects);
  state.activeEventEffects = effects.filter((effect) => ["end_of_day_resource_set", "disable_overtime"].includes(effect.type));
  effects.forEach((effect) => {
    if (effect.type === "agent_parameter_delta") {
      state.agents.forEach((agent) => applyAgentParameterDelta(agent, effect));
    } else if (effect.type === "resource_delta") {
      applyResourceDelta({ [effect.resource]: getEffectAmount(effect, "amount") });
    } else if (effect.type === "grant_status") {
      state.agents.forEach((agent) => grantAgentStatus(agent, effect.statusId, effect.stacks));
    } else if (effect.type === "enable_path") {
      setPathEnabled(effect.pathId, true);
    } else if (effect.type === "disable_path") {
      setPathEnabled(effect.pathId, false);
    } else if (effect.type === "path_energy_delta") {
      adjustPathEnergy(effect.pathId, getEffectAmount(effect, "amount"));
    }
  });
}
