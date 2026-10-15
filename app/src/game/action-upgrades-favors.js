import { state } from "./state.js";
import { upgrades } from "./data.js";
import { applyUpgradeBuyEffects } from "./upgrade-effects-runtime.js";
import {
  adjustSympathy,
  canAfford,
  getSelectedAgent,
  spendResourcesWithAgentRefund,
} from "./rules.js";
import { render } from "./render-core.js";
import { addLog, showToast } from "./action-feedback.js";

export function completeFavor(agentId) {
  const agent = state.agents.find((item) => item.id === agentId);
  const favor = state.favors[agentId];
  if (!agent || !favor || state.completedFavors[agentId]) return;
  if (!canAfford(favor.cost)) {
    showToast("Не хватает ресурсов на одолжение.");
    return;
  }

  spendResourcesWithAgentRefund(agent, favor.cost);
  adjustSympathy(agent, favor.sympathy);
  state.completedFavors[agentId] = true;
  addLog(`${agent.name}: выполнено одолжение «${favor.name}», +${favor.sympathy} симпатии.`);

  render();
}

export function buyUpgrade(upgradeId, free = false) {
  const upgrade = upgrades.find((item) => item.id === upgradeId);
  if (!upgrade || state.purchasedUpgrades.includes(upgrade.id)) return false;

  const selectedAgent = getSelectedAgent();
  if (!free && selectedAgent.locationId !== "upgrade-shop") {
    showToast("Для покупки нужен агент в Магазине апгрейдов.");
    return false;
  }

  if (!free) {
    if (!canAfford(upgrade.cost)) {
      showToast("Не хватает ресурсов на апгрейд.");
      return false;
    }
    spendResourcesWithAgentRefund(selectedAgent, upgrade.cost);
  }

  state.purchasedUpgrades.push(upgrade.id);
  applyUpgradeBuyEffects(upgrade, { agent: selectedAgent, upgrade });
  addLog(`${free ? "Подарок" : "Покупка"}: апгрейд «${upgrade.name}».`);
  render();
  return true;
}

export function grantFreeUpgrade() {
  const upgrade = upgrades.find((item) => !state.purchasedUpgrades.includes(item.id));
  if (upgrade) buyUpgrade(upgrade.id, true);
}

export function convertReputationToSympathy() {
  const agent = getSelectedAgent();
  if (state.resources.reputation < 1) return;
  spendResourcesWithAgentRefund(agent, { reputation: 1 });
  adjustSympathy(agent, 2);
  addLog(`${agent.name} получает +2 симпатии за 1 РЕП.`);
  render();
}
