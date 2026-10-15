import { state } from "./state.js";
import { addLog } from "./action-feedback.js";
import { normalizeBarSettings } from "./bar-settings.js";

const BLOOD_TIERS = [
  { resource: "bloodTier3", label: "Т3", priceField: "priceTier3" },
  { resource: "bloodTier2", label: "Т2", priceField: "priceTier2" },
  { resource: "bloodTier1", label: "Т1", priceField: "priceTier1" },
];

export function getAutoServicePreview(resources = state.resources, settings = state.barSettings) {
  const normalized = normalizeBarSettings(settings);
  let remaining = normalized.autoServiceLimit;
  const result = { drinks: 0, money: 0, byTier: [] };

  BLOOD_TIERS.forEach((tier) => {
    if (!remaining) return;
    const available = Math.max(0, Math.trunc(Number(resources[tier.resource]) || 0));
    const drinks = Math.min(remaining, Math.floor(available / normalized.bloodPerDrink));
    if (!drinks) return;
    const money = drinks * normalized[tier.priceField];
    result.drinks += drinks;
    result.money += money;
    result.byTier.push({ ...tier, drinks, bloodSpent: drinks * normalized.bloodPerDrink, money });
    remaining -= drinks;
  });
  return result;
}

export function runAutoService() {
  const result = getAutoServicePreview();
  state.autoServiceLastRun = result;
  if (!result.drinks) return result;
  result.byTier.forEach((tier) => {
    state.resources[tier.resource] -= tier.bloodSpent;
  });
  state.resources.money += result.money;
  const tiers = result.byTier.map((tier) => `${tier.drinks} из ${tier.label}`).join(", ");
  addLog(`Бар: автообслуживание продало ${result.drinks} напитк. (${tiers}) и принесло ${result.money}$.`);
  return result;
}
