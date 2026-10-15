import { getSympathyTraitEntries } from "./agent-traits.js";
import { normalizeAgentFatigue } from "./agent-parameters.js";
import { normalizeTraitRefFromCatalog, normalizeTraitRefsFromCatalog } from "./trait-contract.js";
import { deepClone } from "./utils.js";

export function normalizeAgentBlueprint(agent, traitCatalog = []) {
  const sympathyTraits = getSympathyTraitEntries(agent)
    .map((entry) => ({ ...entry, trait: normalizeTraitRefFromCatalog(entry.trait, traitCatalog) }))
    .filter((entry) => entry.trait);
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    portrait: agent.portrait,
    color: agent.color,
    maxEnergy: agent.maxEnergy,
    energy: agent.energy,
    baseRecovery: agent.baseRecovery,
    fatigue: normalizeAgentFatigue(agent.fatigue),
    isMainCharacter: Boolean(agent.isMainCharacter),
    sympathy: agent.sympathy,
    overtimeMax: agent.overtimeMax,
    overtimeLeft: agent.overtimeLeft,
    locationId: agent.locationId,
    startLocationId: agent.startLocationId,
    traits: normalizeTraitRefsFromCatalog(agent.traits || [], traitCatalog),
    sympathyTraits: deepClone(sympathyTraits),
    statuses: normalizeAgentStatuses(agent.statuses),
  };
}

function normalizeAgentStatuses(statuses) {
  if (!Array.isArray(statuses)) return [];
  return statuses
    .map((status) => {
      const statusId = String(status?.statusId || "").trim();
      const stacks = Math.max(1, Math.trunc(Number(status?.stacks) || 1));
      const remainingDays = Math.max(1, Math.trunc(Number(status?.remainingDays) || 1));
      return statusId ? { statusId, stacks, remainingDays } : null;
    })
    .filter(Boolean);
}
