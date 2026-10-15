import { createInitialState, state, WORKING_DAYS_PER_WEEK } from "./state.js";
import { resolveEffectNumber } from "./effect-value.js";
import { eventDeck, favorDeck, locations } from "./data.js";
import {
  applyDailyFatigue,
  applyInitialConfigToState,
  formatResourceObject,
  getBossShare,
  getDayCalendarInfo,
  getNextWorkingDay,
  getRecovery,
  getSelectedAgent,
  getVisibleLocations,
  getWorkingDayNumber,
} from "./rules.js";
import { render } from "./render-core.js";
import { applyEventEffects } from "./event-effects-runtime.js";
import { getAgentDailyUpkeepCosts, getAgentMaxEnergy, getAgentOvertimeMax, getAgentTraitEffects } from "./trait-effects-runtime.js";
import { addLog, showToast } from "./action-feedback.js";
import { startWeekend } from "./action-weekend.js";
import { advanceAgentStatuses, grantAgentStatus } from "./status-effects-runtime.js";
import { restockLocationShops } from "./location-mechanics.js";
import { applyLocationVisibilityDayConditions } from "./location-visibility.js";
import { runAutoService } from "./bar-auto-service.js";

export function startNextDay() {
  if (state.weekend?.active) {
    showToast("Сначала завершите две активности выходных.");
    return;
  }

  runAutoService();
  applyEndOfDayEffects();
  if (getDayCalendarInfo().weekdayIndex === WORKING_DAYS_PER_WEEK - 1) {
    startWeekend();
    return;
  }

  state.day = getNextWorkingDay();
  applyLocationVisibilityDayConditions(state, locations);
  restockLocationShops(state, locations, "daily");
  state.taskUses = {};
  state.completedFavors = {};
  state.flags = {};
  state.activeEventEffects = [];
  state.lastTaskRoll = null;

  state.agents.forEach((agent) => {
    agent.locationId = agent.startLocationId;
    agent.overtimeLeft = getAgentOvertimeMax(agent);
    getAgentTraitEffects(agent, "grant_status").forEach((effect) => grantAgentStatus(agent, effect.statusId, effect.stacks));
    applyDailyFatigue(agent);
    agent.energy = Math.min(getAgentMaxEnergy(agent), agent.energy + getRecovery(agent));
  });

  applyAgentUpkeep();
  applyBossShare();
  assignFavors();
  drawEvent();

  state.selectedLocationId = getSelectedAgent().locationId;
  if (!getVisibleLocations().some((location) => location.id === state.selectedLocationId)) {
    state.selectedLocationId = getVisibleLocations()[0]?.id || "";
  }
  state.locationPanelOpen = false;
  const calendar = getDayCalendarInfo();
  if (calendar.weekdayIndex === 0) {
    restockLocationShops(state, locations, "weekly");
    applyWeeklyTraitEffects();
  }
  addLog(`Начался день ${calendar.day}: неделя ${calendar.week}, ${calendar.weekday}. Агенты вернулись в стартовые локации.`);
  render();
}

export function applyWeeklyTraitEffects() {
  state.agents.forEach((agent) => {
    getAgentTraitEffects(agent, "weekly_inspiration").forEach(() => grantAgentStatus(agent, "inspiration", 2));
  });
}

export function restartGame() {
  const freshState = createInitialState();
  applyInitialConfigToState(freshState);
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, freshState);
  applyWeeklyTraitEffects();
  assignFavors();
  addLog("Кампания начата заново.");
  render();
  showToast("Начали сначала.");
}

export function applyEndOfDayEffects() {
  state.agents.forEach(advanceAgentStatuses);
  const endOfDayResourceEffects = (state.activeEventEffects || []).filter((effect) => effect.type === "end_of_day_resource_set");
  if (!endOfDayResourceEffects.length) return;
  endOfDayResourceEffects.forEach((effect) => {
    state.resources[effect.resource] = Math.max(0, resolveEffectNumber(effect.amount));
  });
  addLog("Эффект события изменил запасы в конце дня.");
}

export function applyAgentUpkeep() {
  state.agents.forEach((agent) => {
    const costs = getAgentDailyUpkeepCosts(agent);
    Object.entries(costs).forEach(([resource, amount]) => {
      if (amount <= 0) return;
      if (resource === "money") {
        if (state.resources.money >= amount) {
          state.resources.money -= amount;
          addLog(`${agent.name}: содержание стоит ${amount}$.`);
        } else {
          state.resources.debt += amount - state.resources.money;
          state.resources.money = 0;
          addLog(`${agent.name}: содержание ушло в долг.`);
        }
        return;
      }

      const available = state.resources[resource] || 0;
      state.resources[resource] = Math.max(0, available - amount);
      addLog(`${agent.name}: содержание ${formatResourceObject({ [resource]: -amount })}.`);
    });
  });
}

export function applyBossShare() {
  const due = getBossShare();
  if (!due) return;
  const paid = Math.min(state.resources.money, due);
  state.resources.money -= paid;
  const short = due - paid;
  if (short > 0) {
    state.resources.debt += short;
    addLog(`Босс требует ${due}$: не хватило ${short}$, долг вырос.`);
  } else {
    addLog(`Босс получил долю: ${due}$.`);
  }
}

export function drawEvent() {
  const workingDay = getWorkingDayNumber();
  if (workingDay < 2) {
    state.event = null;
    return;
  }
  const event = eventDeck[(workingDay - 2) % eventDeck.length];
  state.event = event;
  applyEventEffects(event);
  addLog(`Событие дня: ${event.name}.`);
}

export function assignFavors() {
  const workingDay = getWorkingDayNumber();
  state.favors = {};
  state.agents.forEach((agent) => {
    const deck = favorDeck[agent.id];
    state.favors[agent.id] = deck ? deck[(workingDay - 1) % deck.length] : null;
  });
}
