import { adjustAgentFatigue, normalizeAgentFatigue } from "./agent-parameters.js";
import { adjustSympathy, applyResourceDelta } from "./rules.js";
import { normalizeUpgradeEffectList } from "./upgrade-effect-registry.js";
import { getAgentMaxEnergy, getAgentOvertimeMax } from "./trait-effects-runtime.js";
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

function applyAgentParameterSet(agent, effect) {
  if (!agent) return;
  const value = getEffectAmount(effect, "value");
  switch (effect.parameter) {
    case "energy":
      agent.energy = clampValue(value, 0, getAgentMaxEnergy(agent));
      break;
    case "recovery":
      agent.baseRecovery = Math.max(0, value);
      break;
    case "sympathy":
      agent.sympathy = value;
      break;
    case "overtime":
      agent.overtimeLeft = clampValue(value, 0, getAgentOvertimeMax(agent));
      break;
    case "fatigue":
      agent.fatigue = normalizeAgentFatigue(value);
      break;
    default:
      break;
  }
}

export function applyUpgradeBuyEffects(upgrade, context = {}) {
  const agent = context.agent;
  normalizeUpgradeEffectList(upgrade.buyEffects).forEach((effect) => {
    if (effect.type === "agent_parameter_delta") {
      applyAgentParameterDelta(agent, effect);
    } else if (effect.type === "agent_parameter_set") {
      applyAgentParameterSet(agent, effect);
    } else if (effect.type === "resource_delta") {
      applyResourceDelta({ [effect.resource]: getEffectAmount(effect, "amount") });
    } else if (effect.type === "enable_path") {
      setPathEnabled(effect.pathId, true);
    } else if (effect.type === "disable_path") {
      setPathEnabled(effect.pathId, false);
    } else if (effect.type === "path_energy_delta") {
      adjustPathEnergy(effect.pathId, getEffectAmount(effect, "amount"));
    }
  });
}
