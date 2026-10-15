import { statusEffects } from "./data.js";
import { normalizeStatusEffectList } from "./status-effect-registry.js";
import { resolveEffectNumber } from "./effect-value.js";

function getStatusCatalogEntry(statusId) {
  return statusEffects.find((status) => status.id === statusId) || null;
}

function normalizeStatusInstance(status) {
  const statusId = String(status?.statusId || "").trim();
  const stacks = Math.max(1, Math.trunc(Number(status?.stacks) || 1));
  const remainingDays = Math.max(1, Math.trunc(Number(status?.remainingDays) || 1));
  return statusId ? { statusId, stacks, remainingDays } : null;
}

export function getAgentStatuses(agent) {
  if (!Array.isArray(agent?.statuses)) return [];
  return agent.statuses
    .map(normalizeStatusInstance)
    .filter(Boolean)
    .map((instance) => {
      const status = getStatusCatalogEntry(instance.statusId);
      return status ? { ...instance, status, effects: normalizeStatusEffectList(status.effects) } : null;
    })
    .filter(Boolean);
}

export function grantAgentStatus(agent, statusId, stacks = 1) {
  const status = getStatusCatalogEntry(String(statusId || "").trim());
  if (!agent || !status) return null;
  const grantedStacks = Math.min(status.maxStacks, Math.max(1, Math.trunc(Number(stacks) || 1)));
  agent.statuses = Array.isArray(agent.statuses) ? agent.statuses : [];
  const existing = agent.statuses.find((item) => item?.statusId === status.id);
  if (existing) {
    existing.stacks = Math.min(status.maxStacks, Math.max(1, Number(existing.stacks) || 1) + grantedStacks);
    existing.remainingDays = status.duration;
    return existing;
  }
  const instance = { statusId: status.id, stacks: grantedStacks, remainingDays: status.duration };
  agent.statuses.push(instance);
  return instance;
}

export function advanceAgentStatuses(agent) {
  if (!Array.isArray(agent?.statuses)) return;
  agent.statuses = agent.statuses
    .map(normalizeStatusInstance)
    .filter(Boolean)
    .map((status) => ({ ...status, remainingDays: status.remainingDays - 1 }))
    .filter((status) => status.remainingDays > 0);
}

export function getAgentStatusEffectAmount(agent, type, field = "amount", match = null) {
  return getAgentStatuses(agent).reduce(
    (total, status) =>
      total +
      status.effects
        .filter((effect) => effect.type === type && (!match || effect.parameter === match))
        .reduce((sum, effect) => sum + resolveEffectNumber(effect[field]) * status.stacks, 0),
    0
  );
}

export function getAgentStatusParameterSources(agent, parameter) {
  const normalizedParameter = String(parameter || "").trim();
  return getAgentStatuses(agent).flatMap((status) =>
    status.effects
      .filter((effect) => effect.type === "agent_parameter_delta" && effect.parameter === normalizedParameter)
      .map((effect) => ({
        name: status.status.name,
        stacks: status.stacks,
        amount: resolveEffectNumber(effect.amount) * status.stacks,
      }))
  );
}

export function getAgentStatusSpecialties(agent) {
  return new Set(
    getAgentStatuses(agent).flatMap((status) =>
      status.effects.filter((effect) => effect.type === "specialization").map((effect) => effect.stat)
    )
  );
}

function checkScopeMatches(scope, stat) {
  if (scope === "any") return true;
  return (
    (scope === "physical" && stat === "agility") ||
    (scope === "social" && stat === "charisma") ||
    (scope === "mental" && stat === "intelligence")
  );
}

function isProfileInspirationAdvantage(status, effect) {
  return status.statusId === "inspiration" && effect.type === "check_advantage";
}

function getStatusCheckCount(agent, type, stat) {
  return getAgentStatuses(agent).reduce(
    (total, status) =>
      total +
      status.effects
        .filter((effect) => effect.type === type && checkScopeMatches(effect.scope, stat))
        .filter((effect) => !(type === "check_advantage" && isProfileInspirationAdvantage(status, effect)))
        .reduce((sum, _effect) => sum + status.stacks, 0),
    0
  );
}

export function getTemporaryStatusCheckEffects(agent, stat) {
  return getAgentStatuses(agent).flatMap((status) =>
    status.effects
      .filter(
        (effect) =>
          (effect.type === "temporary_check_advantage" || effect.type === "temporary_check_penalty" || isProfileInspirationAdvantage(status, effect)) &&
          checkScopeMatches(effect.scope, stat)
      )
      .map((effect) => ({
        statusId: status.statusId,
        name: status.status.name,
        type: isProfileInspirationAdvantage(status, effect) ? "temporary_check_advantage" : effect.type,
      }))
  );
}

export function getTemporaryStatusCheckAdvantageCount(agent, stat) {
  return getTemporaryStatusCheckEffects(agent, stat).filter((effect) => effect.type === "temporary_check_advantage").length;
}

export function getTemporaryStatusCheckPenaltyCount(agent, stat) {
  return getTemporaryStatusCheckEffects(agent, stat).filter((effect) => effect.type === "temporary_check_penalty").length;
}

export function consumeTemporaryStatusCheckEffects(agent, stat, { advantage = true, penalty = true } = {}) {
  if (!Array.isArray(agent?.statuses)) return [];
  const consumed = getTemporaryStatusCheckEffects(agent, stat).filter(
    (effect) => (advantage && effect.type === "temporary_check_advantage") || (penalty && effect.type === "temporary_check_penalty")
  );
  const spentByStatusId = consumed.reduce((amounts, effect) => {
    amounts.set(effect.statusId, (amounts.get(effect.statusId) || 0) + 1);
    return amounts;
  }, new Map());
  agent.statuses = agent.statuses
    .map((status) => {
      const amount = spentByStatusId.get(status?.statusId) || 0;
      return amount ? { ...status, stacks: Math.max(0, (Number(status.stacks) || 0) - amount) } : status;
    })
    .filter((status) => Number(status?.stacks) > 0);
  return consumed;
}

export function getStatusCheckAdvantageCount(agent, stat) {
  return getStatusCheckCount(agent, "check_advantage", stat);
}

export function getStatusCheckPenaltyCount(agent, stat) {
  return getStatusCheckCount(agent, "check_penalty", stat);
}

export function hasStatusCheckAdvantage(agent, stat) {
  return getStatusCheckAdvantageCount(agent, stat) > 0;
}

export function hasStatusCheckPenalty(agent, stat) {
  return getStatusCheckPenaltyCount(agent, stat) > 0;
}
