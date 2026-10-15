import { gameSettings, pendingEditorChanges, resourceDefs, runtime, state, WEEKDAY_NAMES, WORKING_DAYS_PER_WEEK } from "./state.js";
import { eventDeck, locations, paths, tasks, upgrades, zones } from "./data.js";
import { serializeAgent } from "./persistence.js";
import { deepClone } from "./utils.js";
import { adjustAgentFatigue } from "./agent-parameters.js";
import { isAgentSympathyEnabled } from "./agent-main-character.js";
import { formatSignedNumber, getSympathyScaleSections, getSympathySectionInfo } from "./agent-traits.js";
import {
  addResourceCosts,
  applyOutcomeDelta,
  applyResourceDelta,
  canAfford,
  splitOutcomeDelta,
  spendResources,
  spendResourcesWithAgentRefund,
} from "./gameplay-commands.js";
import {
  getAgentEffectiveSympathy,
  getAgentEffectiveFatigue,
  getAgentMovementEnergyCost,
  getAgentOvertimeMax,
  getAgentRecoveryModifier,
  getAgentTraitParameterSources,
  getAgentSympathyGainAmount,
  hasAgentSpecialty,
} from "./trait-effects-runtime.js";
import { getTraitDescription as getCatalogTraitDescription, getTraitDisplayName } from "./trait-catalog.js";
import { rollTaskCheck } from "./task-mechanic-registry.js";
import {
  getAgentStatusEffectAmount,
  getAgentStatusParameterSources,
  getStatusCheckAdvantageCount,
  getStatusCheckPenaltyCount,
  getTemporaryStatusCheckAdvantageCount,
  getTemporaryStatusCheckPenaltyCount,
} from "./status-effects-runtime.js";
import { getPathEnergy, initializePathStates, isPathEnabled } from "./path-runtime.js";
import { initializeLocationMechanicState } from "./location-mechanics.js";
import { initializeLocationVisibility, isLocationVisible } from "./location-visibility.js";

export function applyInitialConfigToState(targetState) {
  const initialResources = deepClone(runtime.initialResources);
  targetState.resources = Object.fromEntries(
    Object.entries(targetState.resources).map(([resource, value]) => [resource, initialResources[resource] ?? value])
  );
  targetState.barSettings = deepClone(runtime.barSettings);
  targetState.agents = runtime.agentBlueprints.map(serializeAgent);
  if (!targetState.agents.some((agent) => agent.id === targetState.selectedAgentId)) {
    targetState.selectedAgentId = targetState.agents[0]?.id || "";
  }
  if (!locations.some((location) => location.id === targetState.selectedLocationId)) {
    targetState.selectedLocationId = locations[0]?.id || "";
  }
  initializePathStates(targetState);
  initializeLocationMechanicState(targetState, locations);
  initializeLocationVisibility(targetState, locations);
  if (!isLocationAvailable(getLocation(targetState.selectedLocationId))) {
    targetState.selectedLocationId = getVisibleLocationsForState(targetState)[0]?.id || "";
  }
}

export function getLocation(locationId) {
  return locations.find((location) => location.id === locationId);
}

export function getVisibleLocations() {
  return getVisibleLocationsForState(state);
}

export function getVisibleLocationsForState(targetState) {
  return locations.filter((location) => isLocationAvailable(location, targetState));
}

export function isLocationAvailable(location, targetState = state) {
  return Boolean(location) && isLocationVisible(location, targetState);
}

export function getDayCalendarInfo(day = state.day) {
  const normalizedDay = Math.max(1, Math.trunc(Number(day) || 1));
  const weekdayIndex = (normalizedDay - 1) % WEEKDAY_NAMES.length;
  return {
    day: normalizedDay,
    week: Math.floor((normalizedDay - 1) / WEEKDAY_NAMES.length) + 1,
    weekdayIndex,
    weekday: WEEKDAY_NAMES[weekdayIndex],
    isWorkingDay: weekdayIndex < WORKING_DAYS_PER_WEEK,
  };
}

export function getWorkingDayNumber(day = state.day) {
  const calendar = getDayCalendarInfo(day);
  return (calendar.week - 1) * WORKING_DAYS_PER_WEEK + Math.min(calendar.weekdayIndex + 1, WORKING_DAYS_PER_WEEK);
}

export function getNextWorkingDay(day = state.day) {
  let nextDay = getDayCalendarInfo(day).day + 1;
  while (!getDayCalendarInfo(nextDay).isWorkingDay) nextDay += 1;
  return nextDay;
}

export function formatDayLabel(day = state.day) {
  const calendar = getDayCalendarInfo(day);
  return `День ${calendar.day} · Неделя ${calendar.week} · ${calendar.weekday}`;
}

export function getZone(zoneId) {
  return zones.find((zone) => zone.id === zoneId);
}

export function getSelectedAgent() {
  return state.agents.find((agent) => agent.id === state.selectedAgentId);
}

export function getMainCharacter() {
  return state.agents.find((agent) => agent.isMainCharacter) || null;
}

export function getSelectedLocation() {
  return getLocation(state.selectedLocationId);
}

export function getTasksForLocation(locationId) {
  return tasks.filter((task) => task.locationId === locationId);
}

export function getOrderDemand() {
  return getWorkingDayNumber() >= 5 ? 2 : 1;
}

export function getBossShare(day = state.day) {
  const workingDay = getWorkingDayNumber(day);
  return workingDay >= 3 ? (workingDay - 2) * 10 : 0;
}

export function hasUpgrade(upgradeId) {
  return state.purchasedUpgrades.includes(upgradeId);
}

export function getCocktailBatch() {
  if (hasUpgrade("mass-production-2")) return { blood: 12, success: 6, failure: 4 };
  if (hasUpgrade("mass-production-1")) return { blood: 8, success: 4, failure: 2 };
  return { blood: 4, success: 2, failure: 1 };
}

export function getMarketingInvestment() {
  return hasUpgrade("marketing-guru") && state.resources.money >= 30 ? 30 : 10;
}

export function getOrderPayoutPerCocktail() {
  return hasUpgrade("dramatic-serving") ? 14 : 12;
}

export function sympathyInfo(value) {
  const section = getSympathySectionInfo(value);
  return {
    ...section,
    name: section.label,
  };
}

export function getRecovery(agent) {
  return Math.max(
    0,
    agent.baseRecovery + sympathyInfo(getAgentEffectiveSympathy(agent)).mod + getAgentRecoveryModifier(agent) - getAgentEffectiveFatigue(agent)
  );
}

export function getRecoveryBreakdown(agent) {
  const sympathy = sympathyInfo(getAgentEffectiveSympathy(agent));
  const parts = [`База ${agent.baseRecovery}`];
  if (sympathy.mod !== 0) {
    parts.push(`Симпатия ${sympathy.name} ${formatSignedNumber(sympathy.mod)}`);
  }
  getAgentTraitParameterSources(agent, "recovery").forEach((source) => {
    if (source.amount !== 0) parts.push(`Черта «${source.name}» ${formatSignedNumber(source.amount)}`);
  });
  getAgentStatusParameterSources(agent, "recovery").forEach((source) => {
    if (source.amount !== 0) {
      const stacks = source.stacks > 1 ? ` x${source.stacks}` : "";
      parts.push(`Статус «${source.name}»${stacks} ${formatSignedNumber(source.amount)}`);
    }
  });
  const fatigue = getAgentEffectiveFatigue(agent);
  if (fatigue !== 0) {
    parts.push(`Усталость ${formatSignedNumber(-fatigue)}`);
  }
  return `Восстановление энергии: ${parts.join(" + ")} = ${getRecovery(agent)}`;
}

export function getDailyFatigueDelta() {
  return 1;
}

export function applyDailyFatigue(agent) {
  return adjustAgentFatigue(agent, getDailyFatigueDelta(agent));
}

export function hasSpecialty(agent, stat) {
  return hasAgentSpecialty(agent, stat);
}

export function getTaskStat(task) {
  return task.stat;
}

export function formatResource(resource, amount, withSign = false) {
  const def = resourceDefs[resource];
  const sign = withSign && amount > 0 ? "+" : "";
  if (resource === "money") return `${sign}${amount}$`;
  return `${sign}${amount} ${def?.short || resource}`;
}

export function formatResourceObject(delta, withSign = true) {
  const entries = Object.entries(delta || {}).filter(([, amount]) => amount !== 0);
  if (!entries.length) return "без ресурсов";
  return entries.map(([resource, amount]) => formatResource(resource, amount, withSign)).join(", ");
}

export function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeHtml(value) {
  return escapeAttribute(value);
}

export function getEditorEntityName(scope, id) {
  if (scope === "agent") return runtime.agentBlueprints.find((agent) => agent.id === id)?.name || id;
  if (scope === "trait") return getTraitDisplayName(id) || id;
  if (scope === "upgrade") return upgrades.find((upgrade) => upgrade.id === id)?.name || id;
  if (scope === "event") return eventDeck.find((event) => event.id === id)?.name || id;
  if (scope === "zone") return zones.find((zone) => zone.id === id)?.name || id;
  if (scope === "path") return paths.find((edge) => edge.id === id)?.name || id;
  if (scope === "location") return locations.find((location) => location.id === id)?.name || id;
  if (scope === "task") return tasks.find((task) => task.id === id)?.name || id;
  return id;
}

export function getEditorChangeLabel(scope, id, field = "") {
  const name = getEditorEntityName(scope, id);
  if (scope === "agent") return `Агент «${name}»`;
  if (scope === "trait") return `Черта «${name}»`;
  if (scope === "upgrade") return `Апгрейд «${name}»`;
  if (scope === "event") return `Событие «${name}»`;
  if (scope === "zone" && field === "points") return `Очертания зоны «${name}»`;
  if (scope === "zone" && field === "position") return `Положение зоны «${name}»`;
  if (scope === "zone") return `Зона «${name}»`;
  if (scope === "path") return `Путь «${name}»`;
  if (scope === "location" && field === "position") return `Положение локации «${name}»`;
  if (scope === "location") return `Локация «${name}»`;
  if (scope === "task") return `Задача «${name}»`;
  if (scope === "resource") return "Начальные ресурсы";
  if (scope === "settings") return "Настройки игры";
  if (scope === "storage") return "Настройки хранилища";
  return "Конфигурация";
}

export function recordEditorChange(scope, id, field = "") {
  const key = `${scope}:${id}:${field}`;
  pendingEditorChanges.set(key, getEditorChangeLabel(scope, id, field));
}

export function getEditorChangeSummary() {
  const changes = Array.from(pendingEditorChanges.values());
  if (!changes.length) return ["Конфигурация редактора"];
  const visible = changes.slice(0, 5);
  if (changes.length > visible.length) visible.push(`Ещё ${changes.length - visible.length}`);
  return visible;
}

export function clearEditorChangeSummary() {
  pendingEditorChanges.clear();
}

export function getTraitDescription(trait) {
  return getCatalogTraitDescription(trait);
}

export function getAvailableOvertime(agent) {
  const overtimeLeft = Math.min(Math.max(0, Number(agent.overtimeLeft) || 0), getAgentOvertimeMax(agent));
  if ((state.activeEventEffects || []).some((effect) => effect.type === "disable_overtime") || overtimeLeft <= 0) return 0;
  if (isAgentSympathyEnabled(agent) && getSympathySectionInfo(getAgentEffectiveSympathy(agent)).section <= getSympathyScaleSections()[0].section) return 0;
  return overtimeLeft;
}

export function getEnergySpendPreview(agent, amount = 0, resourceCost = {}) {
  const regular = Math.min(agent.energy, amount);
  const overtime = Math.max(0, amount - regular);
  const extraCost = {};
  let sympathyLoss = 0;
  let reason = null;

  if (overtime > 0) {
    if ((state.activeEventEffects || []).some((effect) => effect.type === "disable_overtime")) {
      reason = "Переработка сегодня недоступна.";
    } else if (agent.overtimeLeft < overtime) {
      reason = "Не хватает энергии переработки.";
    } else if (isAgentSympathyEnabled(agent) && getSympathySectionInfo(getAgentEffectiveSympathy(agent)).section <= getSympathyScaleSections()[0].section) {
      reason = "Слишком низкая симпатия для переработки.";
    } else {
      const overtimeCostPercent = getAgentStatusEffectAmount(agent, "overtime_sympathy_cost_percent", "percent");
      sympathyLoss = isAgentSympathyEnabled(agent) ? Math.max(0, Math.round((overtime * (100 + overtimeCostPercent)) / 100)) : 0;
    }
  }

  const combinedCost = addResourceCosts(resourceCost, extraCost);
  const hasResources = canAfford(combinedCost);

  return {
    can: !reason && hasResources,
    regular,
    overtime,
    extraCost,
    combinedCost,
    sympathyLoss,
    reason: reason || (hasResources ? "" : "Не хватает ресурсов."),
  };
}

export function canSpendAgentEnergy(agent, amount = 0, resourceCost = {}) {
  return getEnergySpendPreview(agent, amount, resourceCost).can;
}

export function spendAgentEnergy(agent, amount = 0) {
  const preview = getEnergySpendPreview(agent, amount);
  if (!preview.can) return preview;

  agent.energy -= preview.regular;

  if (preview.overtime > 0) {
    agent.overtimeLeft -= preview.overtime;
    adjustSympathy(agent, -preview.sympathyLoss);
  }

  return preview;
}

export function formatOutcomeDelta(delta = {}, withSign = true) {
  const outcome = splitOutcomeDelta(delta);
  const parts = [];
  const resourceText = formatResourceObject(outcome.resources, withSign);
  if (resourceText !== "без ресурсов") parts.push(resourceText);
  if (outcome.fatigue !== 0) parts.push(`${formatSignedNumber(outcome.fatigue)} усталости`);
  return parts.length ? parts.join(", ") : "без ресурсов";
}

export function loseMoney(amount) {
  const paid = Math.min(state.resources.money, amount);
  state.resources.money -= paid;
  state.resources.debt += amount - paid;
}

export function adjustSympathy(agent, amount) {
  if (!isAgentSympathyEnabled(agent)) return 0;
  const adjustedAmount = getAgentSympathyGainAmount(agent, amount);
  agent.sympathy += adjustedAmount;
  return adjustedAmount;
}

export function canUsePath(edge) {
  if (!isPathEnabled(edge)) return false;
  if (state.flags.bridgesClosed && edge.type === "bridge") return false;
  if (state.flags.ovkClosed && ["mansion", "ovk-office"].includes(state.selectedLocationId)) return false;
  return true;
}

export function edgeEnergyCost(agent, edge) {
  const baseCost = state.flags.cheapFerries && edge.type === "ferry" ? 1 : getPathEnergy(edge);
  return getAgentMovementEnergyCost(agent, baseCost, edge.id);
}

export function findPath(agent, fromZoneId, toZoneId) {
  if (fromZoneId === toZoneId) return { energy: 0, toll: {}, edges: [] };

  const unvisited = new Set(zones.map((zone) => zone.id));
  const dist = Object.fromEntries(zones.map((zone) => [zone.id, Infinity]));
  const prev = {};
  dist[fromZoneId] = 0;

  while (unvisited.size) {
    const current = [...unvisited].sort((a, b) => dist[a] - dist[b])[0];
    if (!current || dist[current] === Infinity) break;
    if (current === toZoneId) break;
    unvisited.delete(current);

    paths
      .filter((edge) => canUsePath(edge) && (edge.a === current || edge.b === current))
      .forEach((edge) => {
        const next = edge.a === current ? edge.b : edge.a;
        if (!unvisited.has(next)) return;
        const alt = dist[current] + edgeEnergyCost(agent, edge);
        if (alt < dist[next]) {
          dist[next] = alt;
          prev[next] = { zone: current, edge };
        }
      });
  }

  if (dist[toZoneId] === Infinity) return null;

  const edges = [];
  let cursor = toZoneId;
  while (cursor !== fromZoneId) {
    const step = prev[cursor];
    if (!step) return null;
    edges.unshift(step.edge);
    cursor = step.zone;
  }

  const toll = {};
  edges.forEach((edge) => {
    if (edge.type === "ferry" && hasUpgrade("ferry-pass")) return;
    Object.entries(edge.toll || {}).forEach(([resource, amount]) => {
      toll[resource] = (toll[resource] || 0) + amount;
    });
  });

  return { energy: dist[toZoneId], toll, edges };
}

export function getMoveCost(agent, location) {
  if (!isLocationAvailable(location)) return null;
  const origin = getLocation(agent.locationId);
  return getMoveCostBetween(agent, origin, location);
}

export function getMoveCostBetween(agent, origin, location) {
  if (!origin || !location) return null;
  if (origin.id === location.id) return { energy: 0, toll: {}, edges: [] };
  if (origin.zoneId === location.zoneId) return { energy: getAgentMovementEnergyCost(agent, 1), toll: {}, edges: [] };
  return findPath(agent, origin.zoneId, location.zoneId);
}

export function getAgentRoute(agent) {
  return state.routePlanner.routes[agent.id] || [];
}

export function getRoutePlan(agent, routeLocationIds = getAgentRoute(agent)) {
  const steps = [];
  const totalToll = {};
  let totalEnergy = 0;
  let origin = getLocation(agent.locationId);
  let blocked = false;

  routeLocationIds.forEach((locationId) => {
    const location = getLocation(locationId);
    const cost = !blocked ? getMoveCostBetween(agent, origin, location) : null;
    if (!location || !cost) blocked = true;
    if (cost) {
      totalEnergy += cost.energy;
      Object.entries(cost.toll || {}).forEach(([resource, amount]) => {
        totalToll[resource] = (totalToll[resource] || 0) + amount;
      });
    }
    steps.push({ from: origin, to: location, cost });
    if (location) origin = location;
  });

  return {
    steps,
    totalEnergy,
    totalToll,
    blocked,
  };
}

export function taskUseCount(task) {
  return state.taskUses[task.id] || 0;
}

export function taskLimit(task) {
  if (hasUpgrade("elder-friend") && task.locationId === "retirement-home") return 2;
  return typeof task.maxPerDay === "function" ? task.maxPerDay() : task.maxPerDay || 1;
}

export function isTaskUsedUp(task) {
  return taskUseCount(task) >= taskLimit(task);
}

export function incrementTaskUse(task) {
  state.taskUses[task.id] = taskUseCount(task) + 1;
}

export function rollDie(sides) {
  const safeSides = Math.max(1, Number(sides) || 1);
  return Math.floor(Math.random() * safeSides) + 1;
}

export function rollCheck(agent, stat, energyInvestment, { useTemporaryAdvantage = true } = {}) {
  return rollTaskCheck({
    agent,
    stat,
    energyInvestment,
    settings: gameSettings,
    rollDie,
    hasSpecialty,
    statusAdvantage: getStatusCheckAdvantageCount(agent, stat) + (useTemporaryAdvantage ? getTemporaryStatusCheckAdvantageCount(agent, stat) : 0),
    statusPenalty: getStatusCheckPenaltyCount(agent, stat) + getTemporaryStatusCheckPenaltyCount(agent, stat),
  });
}

export function formatRollResultText(roll) {
  return roll.dice
    .map((die, index) => `${index === 0 ? "" : die.value < 0 ? " - " : " + "}${die.label} ${Math.abs(die.value)}`)
    .join("") + ` = ${roll.total}`;
}

export {
  addResourceCosts,
  applyOutcomeDelta,
  applyResourceDelta,
  canAfford,
  splitOutcomeDelta,
  spendResources,
  spendResourcesWithAgentRefund,
};
