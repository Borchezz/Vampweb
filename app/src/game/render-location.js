import { gameSettings, runtime, state } from "./state.js";
import { dom } from "./dom.js";
import { canAfford, canSpendAgentEnergy, escapeAttribute, escapeHtml, formatResourceObject, getAgentRoute, getEnergySpendPreview, getMoveCost, getRoutePlan, getSelectedAgent, getSelectedLocation, getTasksForLocation, getTaskStat, hasSpecialty, isTaskUsedUp, taskLimit, taskUseCount } from "./rules.js";
import { formatMoveCost } from "./render-map.js";
import { getTaskCost, getTaskReward } from "./task-effects-runtime.js";
import { renderLocationMechanics } from "./render-location-mechanics.js";
import { getTaskDifficultyLabel, getTaskDifficultyValue } from "./task-difficulty-settings.js";
import { getStatusCheckAdvantageCount, getStatusCheckPenaltyCount, getTemporaryStatusCheckAdvantageCount, getTemporaryStatusCheckEffects, getTemporaryStatusCheckPenaltyCount } from "./status-effects-runtime.js";
import { getTaskSuccessChance } from "./task-mechanic-registry.js";
import { isLocationTaskLocked } from "./location-mechanic-effects-runtime.js";
export { getTaskOutcomeEffectPreview } from "./task-outcome-preview.js";
import { getTaskOutcomeEffectPreview } from "./task-outcome-preview.js";

export const TASK_ENERGY_MIN = 1;
export const TASK_ENERGY_MAX = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function overlapArea(candidate, obstacle) {
  const width = Math.max(0, Math.min(candidate.right, obstacle.right) - Math.max(candidate.left, obstacle.left));
  const height = Math.max(0, Math.min(candidate.bottom, obstacle.bottom) - Math.max(candidate.top, obstacle.top));
  return width * height;
}

function getLocationPanelObstacles(panel) {
  return [
    dom.agentDock,
    dom.routePlanner,
    dom.inventoryPanel,
    dom.journalPanel,
    dom.upgradePanel,
    dom.barPanel,
    dom.settingsPanel,
  ]
    .filter((element) => element && element !== panel && element.getAttribute("aria-hidden") !== "true")
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function positionLocationPanel(locationId) {
  const anchor = [...dom.cityMap.querySelectorAll("[data-location-id]")]
    .find((element) => element.dataset.locationId === locationId);
  if (!anchor) return;

  const panel = dom.locationDetailsPanel;
  const mapRect = dom.cityMap.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const panelWidth = panel.offsetWidth;
  const panelHeight = panel.offsetHeight;
  const edgeGap = 12;
  const anchorGap = 14;
  const mapLeft = Math.max(0, mapRect.left) + edgeGap;
  const mapRight = Math.min(window.innerWidth, mapRect.right) - edgeGap;
  const mapTop = Math.max(0, mapRect.top) + edgeGap;
  const mapBottom = Math.min(window.innerHeight, mapRect.bottom) - edgeGap;
  const preferredTop = anchorRect.top + anchorRect.height / 2 - Math.min(72, panelHeight * 0.2);
  const obstacles = getLocationPanelObstacles(panel);
  const horizontalCandidates = [
    { placement: "right", left: clamp(anchorRect.right + anchorGap, mapLeft, mapRight - panelWidth) },
    { placement: "left", left: clamp(anchorRect.left - anchorGap - panelWidth, mapLeft, mapRight - panelWidth) },
  ];
  const verticalCandidates = [
    preferredTop,
    mapTop,
    mapBottom - panelHeight,
    ...obstacles.flatMap((rect) => [rect.top - edgeGap - panelHeight, rect.bottom + edgeGap]),
  ].map((top) => clamp(top, mapTop, mapBottom - panelHeight));

  const candidates = horizontalCandidates.flatMap(({ placement, left }) => verticalCandidates.map((top) => {
    const rect = { left, right: left + panelWidth, top, bottom: top + panelHeight };
    const obstaclePenalty = obstacles.reduce((sum, obstacle) => sum + overlapArea(rect, obstacle), 0) * 100;
    const anchorPenalty = overlapArea(rect, anchorRect) * 20;
    const movementPenalty = Math.abs(top - preferredTop) + Math.abs(left - anchorRect.left) * 0.05;
    return { placement, left, top, score: obstaclePenalty + anchorPenalty + movementPenalty };
  }));
  const best = candidates.sort((a, b) => a.score - b.score)[0];

  panel.style.setProperty("--location-popover-left", `${Math.round(best.left)}px`);
  panel.style.setProperty("--location-popover-top", `${Math.round(best.top)}px`);
  panel.dataset.placement = best.placement;
}

export function renderLocationPanel() {
  const agent = getSelectedAgent();
  const location = getSelectedLocation();
  const moveCost = getMoveCost(agent, location);
  const isCurrentLocation = moveCost && moveCost.energy === 0;
  const canMove = moveCost && !isCurrentLocation && canSpendAgentEnergy(agent, moveCost.energy, moveCost.toll);

  dom.locationName.textContent = location.name;
  dom.moveButton.disabled = !canMove || runtime.appMode === "edit";
  dom.moveButton.innerHTML = `<span class="button-icon" aria-hidden="true">></span>${
    isCurrentLocation ? "На месте" : moveCost ? `Идти: ${formatMoveCost(moveCost)}` : "Нет пути"
  }`;

  const locationTasks = getTasksForLocation(location.id);
  dom.taskStack.innerHTML = locationTasks.map((task) => renderTaskCard(task, agent, location)).join("");
  dom.locationMechanics.innerHTML = renderLocationMechanics(location);
  const isOpen = state.locationPanelOpen && runtime.appMode !== "edit" && !state.weekend?.active;
  dom.locationDetailsPanel.classList.toggle("open", isOpen);
  dom.locationDetailsPanel.setAttribute("aria-hidden", String(!isOpen));
  dom.locationDetailsPanel.inert = !isOpen;
  if (isOpen) positionLocationPanel(location.id);
}

export function renderRoutePlanner() {
  if (runtime.appMode === "edit" || state.weekend?.active) {
    dom.routePlanner.innerHTML = "";
    return;
  }

  const agent = getSelectedAgent();
  const selectedLocation = getSelectedLocation();
  const route = getAgentRoute(agent);
  const plan = getRoutePlan(agent, route);
  const nextStep = plan.steps[0];
  const nextCost = nextStep?.cost || null;
  const canExecuteNext =
    Boolean(route.length) &&
    Boolean(nextCost) &&
    (nextCost.energy === 0 || canSpendAgentEnergy(agent, nextCost.energy, nextCost.toll));
  const planning = state.routePlanner.planning;
  const collapsed = state.routePlanner.collapsed;

  if (collapsed) {
    dom.routePlanner.innerHTML = `
      <section class="route-panel collapsed" aria-label="Маршрут агента">
        <div class="route-panel-header">
          <div>
            <h3>Маршрут</h3>
            <p>${escapeHtml(agent.name)} · ${route.length ? `${route.length} т.` : "пуст"}</p>
          </div>
          <div class="route-header-actions">
            <button class="secondary-button compact-button route-quick-add-button" type="button" data-route-add="${escapeAttribute(selectedLocation.id)}" aria-label="Добавить ${escapeAttribute(selectedLocation.name)} в маршрут">
              +
            </button>
            <button class="secondary-button compact-button" type="button" data-route-collapse-toggle>
              Развернуть
            </button>
          </div>
        </div>
      </section>
    `;
    return;
  }

  dom.routePlanner.innerHTML = `
    <section class="route-panel ${planning ? "planning" : ""}" aria-label="Маршрут агента">
      <div class="route-panel-header">
        <div class="route-panel-title">
          <div class="route-title-line">
            <h3>Маршрут</h3>
            ${renderRouteSummary(plan)}
          </div>
          <p>${escapeHtml(agent.name)}</p>
        </div>
        <div class="route-header-actions">
          <button class="secondary-button compact-button" type="button" data-route-clear ${route.length ? "" : "disabled"}>
            Очистить
          </button>
          <button class="secondary-button compact-button" type="button" data-route-collapse-toggle>
            Свернуть
          </button>
        </div>
      </div>
      <div class="route-panel-body">
        <div class="route-controls">
          <div class="route-actions">
            <button class="secondary-button compact-button ${planning ? "active" : ""}" type="button" data-route-planning-toggle>
              ${planning ? "Готово" : "План"}
            </button>
            <button class="secondary-button compact-button" type="button" data-route-add="${escapeAttribute(selectedLocation.id)}" aria-label="Добавить ${escapeAttribute(selectedLocation.name)} в маршрут">
              Добавить
            </button>
            <button class="primary-button compact-button" type="button" data-route-step ${canExecuteNext ? "" : "disabled"}>
              Шаг
            </button>
          </div>
        </div>
        <div class="route-list-pane">
          ${renderRouteStops(plan)}
        </div>
      </div>
    </section>
  `;
}

export function renderRouteSummary(plan) {
  if (!plan.steps.length) return `<div class="route-summary"><span class="tag">Маршрут пуст</span></div>`;
  const toll = formatResourceObject(plan.totalToll, false);
  return `
    <div class="route-summary">
      <span class="tag">Всего: ${plan.totalEnergy} эн.</span>
      ${toll === "без ресурсов" ? "" : `<span class="tag">${toll}</span>`}
      ${plan.blocked ? '<span class="tag danger">Есть недоступный шаг</span>' : ""}
    </div>
  `;
}

export function renderRouteStops(plan) {
  if (!plan.steps.length) return "";
  return `
    <ol class="route-stop-list">
      ${plan.steps
        .map((step, index) => {
          const label = step.to?.name || "Недоступная локация";
          const costLabel = step.cost ? formatMoveCost(step.cost) : "нет пути";
          return `
            <li class="route-stop ${step.cost ? "" : "blocked"}">
              <span>
                <strong>${escapeHtml(label)}</strong>
                <em>${escapeHtml(costLabel)}</em>
              </span>
              <button class="icon-button route-remove-button" type="button" data-route-remove="${index}" aria-label="Удалить точку маршрута ${escapeAttribute(label)}">x</button>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
}

export function getTaskEnergyValues() {
  return Array.from({ length: TASK_ENERGY_MAX - TASK_ENERGY_MIN + 1 }, (_, index) => TASK_ENERGY_MIN + index);
}

function getTaskEnergyHintText(preview) {
  if (!preview) return "";
  if (!preview.can && preview.reason) return `Недоступно: ${preview.reason}`;
  if (preview.overtime <= 0) return "";
  const sympathyText = preview.sympathyLoss > 0 ? `урон симпатии -${preview.sympathyLoss}` : "урон симпатии 0";
  const moneyText = preview.moneyCost > 0 ? `; деньги -${preview.moneyCost}$` : "";
  return `Переработка: ${preview.overtime} эн.; ${sympathyText}${moneyText}`;
}

function getTaskEnergyPreviewEntry(agent, energy, cost, baseDisabled) {
  if (baseDisabled) {
    return { can: false, overtime: 0, sympathyLoss: 0, moneyCost: 0, reason: "", hint: "" };
  }
  const preview = getEnergySpendPreview(agent, energy, cost);
  const entry = {
    can: preview.can,
    overtime: preview.overtime,
    sympathyLoss: preview.sympathyLoss,
    moneyCost: preview.extraCost.money || 0,
    reason: preview.reason,
    hint: "",
  };
  entry.hint = getTaskEnergyHintText(entry);
  return entry;
}

export function renderTaskEnergyControls(task, agent, cost, baseDisabled) {
  const energyValues = getTaskEnergyValues();
  const energyPreviews = Object.fromEntries(
    energyValues.map((energy) => [energy, getTaskEnergyPreviewEntry(agent, energy, cost, baseDisabled)])
  );
  const availableEnergyValues = energyValues.filter((energy) => energyPreviews[energy].can);
  const canUseAnyEnergy = availableEnergyValues.length > 0;
  const selectedEnergy = TASK_ENERGY_MIN;
  const canUseSelectedEnergy = availableEnergyValues.includes(selectedEnergy);
  const maxAffordableEnergy = availableEnergyValues.at(-1) || TASK_ENERGY_MIN;
  const selectedPreview = energyPreviews[selectedEnergy];
  const disabled = !canUseAnyEnergy ? "disabled" : "";
  const decreaseDisabled = !canUseAnyEnergy || selectedEnergy <= TASK_ENERGY_MIN ? "disabled" : "";
  const increaseDisabled = !canUseAnyEnergy || selectedEnergy >= maxAffordableEnergy ? "disabled" : "";
  const affordableValues = escapeAttribute(availableEnergyValues.join(","));
  const previewValues = escapeAttribute(JSON.stringify(energyPreviews));
  const taskStat = getTaskStat(task, agent);
  const difficulty = getTaskDifficultyValue(task, gameSettings.taskDifficultyLevels);
  const temporaryAdvantage = getTemporaryStatusCheckEffects(agent, taskStat).find((effect) => effect.type === "temporary_check_advantage");
  const chanceByEnergy = Object.fromEntries(
    energyValues.map((energy) => [
      energy,
      {
        standard: getRoundedTaskSuccessChance(agent, taskStat, energy, difficulty, false),
        advantage: getRoundedTaskSuccessChance(agent, taskStat, energy, difficulty, true),
      },
    ])
  );
  const chanceValues = escapeAttribute(JSON.stringify(chanceByEnergy));
  const initialChance = chanceByEnergy[selectedEnergy].standard;
  const selectedOvertime = selectedPreview.overtime > 0;
  const overtimeTooltip = selectedOvertime ? ` data-tooltip="${escapeAttribute(selectedPreview.hint)}"` : "";
  const visibleHint = selectedOvertime ? "" : selectedPreview.hint;

  return `
    <div class="task-energy-control" data-task-energy-control data-affordable-energy-values="${affordableValues}" data-task-energy-previews="${previewValues}" data-task-success-chances="${chanceValues}">
      <label class="task-energy-field">
        <span>Энергия броска</span>
        <span class="task-energy-stepper">
          <button class="task-energy-step" type="button" data-task-energy-step="-1" aria-label="Уменьшить энергию" ${decreaseDisabled}>&minus;</button>
          <input
            class="task-energy-input ${selectedOvertime ? "overtime" : ""}"
            type="number"
            min="${TASK_ENERGY_MIN}"
            max="${maxAffordableEnergy}"
            step="1"
            inputmode="numeric"
            value="${selectedEnergy}"
            data-task-energy-input="${task.id}"
            aria-label="Энергия броска для задачи ${escapeAttribute(task.name)}"
            ${overtimeTooltip}
            ${disabled}
          >
          <button class="task-energy-step ${selectedOvertime ? "overtime" : ""}" type="button" data-task-energy-step="1" aria-label="Увеличить энергию"${overtimeTooltip} ${increaseDisabled}>+</button>
        </span>
        <small class="task-energy-hint ${selectedPreview.can ? "" : "blocked"}" data-task-energy-hint aria-live="polite">${escapeHtml(visibleHint)}</small>
      </label>
      ${
        temporaryAdvantage && agent.locationId === task.locationId
          ? `<button class="task-inspiration-button" type="button" data-task-temporary-advantage aria-pressed="false" data-tooltip="Потратить ${escapeAttribute(temporaryAdvantage.name)}: будет потрачен один стак" aria-label="Потратить ${escapeAttribute(temporaryAdvantage.name)}"><span aria-hidden="true">&#10022;</span></button>`
          : ""
      }
      <button class="task-button roll-button" type="button" data-task-id="${task.id}" data-use-selected-energy="true" ${!canUseSelectedEnergy ? "disabled" : ""}>
        Выполнить <span data-task-success-chance>${initialChance}%</span>
      </button>
    </div>
  `;
}

function getRoundedTaskSuccessChance(agent, stat, energy, difficulty, useTemporaryAdvantage) {
  const chance = getTaskSuccessChance({
    agent,
    stat,
    energyInvestment: energy,
    settings: gameSettings,
    hasSpecialty,
    statusAdvantage: getStatusCheckAdvantageCount(agent, stat) + (useTemporaryAdvantage ? getTemporaryStatusCheckAdvantageCount(agent, stat) : 0),
    statusPenalty: getStatusCheckPenaltyCount(agent, stat) + getTemporaryStatusCheckPenaltyCount(agent, stat),
    difficulty,
  });
  return Math.max(0, Math.min(100, Math.round((chance * 100) / 5) * 5));
}

export function renderTaskRollResult(task) {
  const result = state.lastTaskRoll;
  if (!result || result.taskId !== task.id) return "";
  const dice = result.roll.dice
    .map(
      (die) => `
        <span class="roll-die ${die.kind}">
          <span>${escapeHtml(die.label)}</span>
          <strong>${die.value}</strong>
        </span>
      `
    )
    .join("");
  return `
    <div class="roll-result ${result.success ? "success" : "failure"}">
      <div class="roll-result-header">
        <strong>${result.success ? "Успех" : "Провал"}</strong>
        <span>${result.roll.total}${result.difficulty ? ` / ${result.difficulty}` : ""}</span>
      </div>
      <div class="roll-dice">${dice}</div>
      <p>${escapeHtml(result.rewardText)}</p>
    </div>
  `;
}

export function renderTaskOutcomeEffects(task) {
  if (task.kind !== "check") return "";
  return `
    <section class="task-outcomes" aria-label="Последствия задачи">
      ${renderTaskOutcomeEffectList(task, "success", "Успех")}
      ${renderTaskOutcomeEffectList(task, "failure", "Провал")}
    </section>
  `;
}

function renderTaskOutcomeEffectList(task, outcome, title) {
  const effects = getTaskOutcomeEffectPreview(task, outcome);
  return `
    <div class="task-outcome task-outcome-${outcome}">
      <span class="task-outcome-title">${title}</span>
      ${effects.length ? `<ul>${effects.map((effect) => `<li><span>${escapeHtml(effect.label)}</span><strong${effect.tooltip ? ` class="task-status-effect" data-tooltip="${escapeAttribute(effect.tooltip)}" tabindex="0"` : ""}>${escapeHtml(effect.value)}</strong></li>`).join("")}</ul>` : '<p>Нет эффектов</p>'}
    </div>
  `;
}

export function renderTaskCard(task, agent, location) {
  const usedUp = isTaskUsedUp(task);
  const locked = isLocationTaskLocked(state, task.locationId, task.id);
  const atLocation = agent.locationId === location.id;
  const cost = getTaskCost(task);
  const canPay = canAfford(cost);
  const baseDisabled = runtime.appMode === "edit" || usedUp || locked || !atLocation || !canPay;
  const limitText = `${taskUseCount(task)}/${taskLimit(task)} сегодня`;
  const costText = formatResourceObject(cost, false);
  const taskStat = task.stat ? getTaskStat(task, agent) : null;
  const difficultyText = getTaskDifficultyLabel(task, gameSettings.taskDifficultyLevels);
  const hasMatchingSpecialty = taskStat ? hasSpecialty(agent, taskStat) : false;

  let controls = "";
  if (task.kind === "check") {
    controls = renderTaskEnergyControls(task, agent, cost, baseDisabled);
  } else if (task.kind === "opportunity") {
    const disabled = baseDisabled || !canSpendAgentEnergy(agent, 1, cost);
    controls = `
      <button class="task-button" type="button" data-task-id="${task.id}" data-energy="1" ${disabled ? "disabled" : ""}>
        Бросить 2D6
      </button>
    `;
  } else {
    const reward = getTaskReward(task);
    const disabled = baseDisabled;
    controls = `
      <button class="task-button" type="button" data-task-id="${task.id}" ${disabled ? "disabled" : ""}>
        Обмен: ${formatResourceObject(reward)}
      </button>
    `;
  }

  return `
    <article class="task-card task-stat-${escapeAttribute(taskStat || "none")} ${usedUp ? "done" : ""}">
      <div class="task-card-copy">
        <div class="task-card-heading">
          <div class="task-card-title">
            <h3>${task.name}</h3>
            ${hasMatchingSpecialty ? '<span class="task-specialty-indicator" data-tooltip="У агента есть подходящая специализация для этой проверки" tabindex="0" role="img" aria-label="Подходящая специализация">★</span>' : ""}
          </div>
          <div class="task-card-heading-meta">
            ${task.kind === "check" ? `<strong class="task-difficulty">${escapeHtml(difficultyText)}</strong>` : ""}
            <span class="tag task-attempts">${limitText}</span>
          </div>
        </div>
        <p class="muted">${task.description}</p>
      </div>
      <div class="task-meta">
        ${costText === "без ресурсов" ? "" : `<span class="tag">${costText}</span>`}
        ${locked ? '<span class="tag danger">Заблокирована</span>' : ""}
      </div>
      ${renderTaskOutcomeEffects(task)}
      <div class="task-controls">${controls}</div>
      ${renderTaskRollResult(task)}
    </article>
  `;
}
