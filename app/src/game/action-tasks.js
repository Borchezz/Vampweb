import { locations, opportunityTable, tasks } from "./data.js";
import { gameSettings, state } from "./state.js";
import { getTaskDifficultyValue } from "./task-difficulty-settings.js";
import { rollOpportunityDice } from "./gameplay-commands.js";
import {
  applyOutcomeDelta,
  applyResourceDelta,
  canAfford,
  formatOutcomeDelta,
  formatResourceObject,
  formatRollResultText,
  getEnergySpendPreview,
  getSelectedAgent,
  getSelectedLocation,
  getTaskStat,
  hasUpgrade,
  incrementTaskUse,
  isLocationAvailable,
  isTaskUsedUp,
  rollCheck,
  rollDie,
  spendAgentEnergy,
  spendResourcesWithAgentRefund,
} from "./rules.js";
import { applyTaskOutcomeEffects, getTaskCost, getTaskReward, resolveTaskOutcomeDelta } from "./task-effects-runtime.js";
import { consumeTemporaryStatusCheckEffects } from "./status-effects-runtime.js";
import { isLocationTaskLocked } from "./location-mechanic-effects-runtime.js";
import { applyLocationVisibilityTaskConditions } from "./location-visibility.js";
import { render } from "./render-core.js";
import { addLog, showToast } from "./action-feedback.js";

export function performTask(taskId, energyInvestment = 1, useTemporaryAdvantage = false) {
  if (state.weekend?.active) {
    showToast("Задачи доступны в рабочие дни.");
    return;
  }
  const task = tasks.find((item) => item.id === taskId);
  const agent = getSelectedAgent();
  const location = getSelectedLocation();
  if (!task) return;
  if (isLocationTaskLocked(state, task.locationId, task.id)) {
    showToast("Эта задача пока заблокирована механикой локации.");
    return;
  }

  if (isTaskUsedUp(task)) {
    showToast("Лимит этой задачи на сегодня исчерпан.");
    return;
  }

  if (agent.locationId !== task.locationId) {
    showToast(`${agent.name} должен быть в нужной локации.`);
    return;
  }

  if (task.kind === "opportunity") {
    performOpportunity(task, agent);
    return;
  }

  const cost = getTaskCost(task);
  if (!canAfford(cost)) {
    showToast("Не хватает ресурсов для задачи.");
    return;
  }

  if (task.kind === "trade") {
    spendResourcesWithAgentRefund(agent, cost);
    const reward = getTaskReward(task);
    applyResourceDelta(reward);
    applyTradeUpgradeEffects(task);
    incrementTaskUse(task);
    applyLocationVisibilityTaskConditions(state, locations, task.id);
    closeHiddenLocationPanel();
    addLog(`${agent.name}: «${task.name}» - ${formatResourceObject(reward)}.`);
    render();
    return;
  }

  const energySpend = getEnergySpendPreview(agent, energyInvestment, cost);
  if (!energySpend.can) {
    showToast(`${agent.name} не хватает энергии или ресурсов на бросок.`);
    return;
  }

  spendAgentEnergy(agent, energyInvestment);
  spendResourcesWithAgentRefund(agent, cost);

  const taskStat = getTaskStat(task, agent);
  const roll = rollCheck(agent, taskStat, energyInvestment, { useTemporaryAdvantage });
  consumeTemporaryStatusCheckEffects(agent, taskStat, { advantage: useTemporaryAdvantage });
  const difficulty = getTaskDifficultyValue(task, gameSettings.taskDifficultyLevels);
  const success = difficulty === 0 || roll.total >= difficulty;
  const context = { agent, location, total: roll.total, roll, task, spent: cost };
  const reward = resolveTaskOutcomeDelta(task, success ? "success" : "failure", context);
  applyOutcomeDelta(agent, reward);
  applyTaskOutcomeEffects(task, success ? "success" : "failure", context);
  incrementTaskUse(task);
  applyLocationVisibilityTaskConditions(state, locations, task.id);
  closeHiddenLocationPanel();

  const rewardText = formatOutcomeDelta(reward);
  const resultText = formatRollResultText(roll);
  state.lastTaskRoll = {
    taskId: task.id,
    agentId: agent.id,
    success,
    difficulty,
    rewardText,
    roll,
  };
  addLog(`${agent.name}: «${task.name}» - ${resultText}. ${success ? "Успех" : "Провал"}: ${rewardText}.`);
  render();
}

export function applyTradeUpgradeEffects(task) {
  if (hasUpgrade("review-system") && task.id === "order-delivery") {
    applyResourceDelta({ reputation: 1 });
    addLog("Система отзывов: +1 РЕП за исполненный заказ.");
  }
}

function closeHiddenLocationPanel() {
  if (state.locationPanelOpen && !isLocationAvailable(getSelectedLocation())) {
    state.locationPanelOpen = false;
  }
}

export function performOpportunity(task, agent) {
  const energySpend = getEnergySpendPreview(agent, 1);
  if (!energySpend.can) {
    showToast(`${agent.name} не хватает энергии.`);
    return;
  }

  spendAgentEnergy(agent, 1);
  const opportunityRoll = rollOpportunityDice(agent, rollDie);
  const outcome = opportunityTable[opportunityRoll.tableScore];
  outcome.apply({ agent });
  incrementTaskUse(task);
  applyLocationVisibilityTaskConditions(state, locations, task.id);
  closeHiddenLocationPanel();
  addLog(`${agent.name}: Возможность - броски ${opportunityRoll.rolls.join(", ")}, итог ${opportunityRoll.total}. ${outcome.name}.`);
  if (hasUpgrade("opportunity-country") && !state.flags.extraOpportunityUsed) {
    state.flags.extraOpportunityUsed = true;
    state.taskUses[task.id] = 0;
    addLog("Страна возможностей: на карте появилась ещё одна Возможность.");
  }
  render();
}
