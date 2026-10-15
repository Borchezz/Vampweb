import { adjustSympathy, applyResourceDelta, loseMoney } from "../rules.js";
import { getAgentMaxEnergy } from "../trait-effects-runtime.js";

export function applyWildVampireAttack({ agent }) {
  agent.energy = Math.max(0, agent.energy - 5);
}

export function applyOvkTax() {
  loseMoney(15);
}

export function applyUpsetAgent({ agent }) {
  adjustSympathy(agent, -5);
}

export function applyNoopOpportunity() {}

export function applyFoundWallet() {
  applyResourceDelta({ money: 15 });
}

export function applyCoffeeTasting({ agent }) {
  agent.energy = Math.min(getAgentMaxEnergy(agent), agent.energy + 5);
}

export function applyVampireCache() {
  applyResourceDelta({ bloodTier1: 3 });
}

export function applyInfluencerReview() {
  applyResourceDelta({ reputation: 2 });
}

export function applyPersonalOrder() {
  applyResourceDelta({ money: 10, reputation: 1 });
}

export function applyOvkPraise() {
  applyResourceDelta({ money: 10 });
}

export function applyBloodMerchantAward() {
  applyResourceDelta({ reputation: 2 });
}
