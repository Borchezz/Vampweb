import { activities, locations } from "./data.js";
import { state } from "./state.js";
import { resolveEffectNumber } from "./effect-value.js";
import { applyActivityEffects } from "./activity-effects-runtime.js";
import { canAfford, getDayCalendarInfo, getMainCharacter } from "./rules.js";
import { addLog, showToast } from "./action-feedback.js";
import { render } from "./render-core.js";
import { startNextDay } from "./action-day-cycle.js";
import { applyLocationVisibilityDayConditions } from "./location-visibility.js";

export const WEEKEND_ACTIVITY_LIMIT = 2;

function resolveActivityEffectAmounts(activity) {
  return {
    ...activity,
    effects: (activity?.effects || []).map((effect) => (
      Object.hasOwn(effect, "amount") ? { ...effect, amount: resolveEffectNumber(effect.amount) } : effect
    )),
  };
}

export function getWeekendActivityCost(activity) {
  return (activity?.effects || []).reduce((cost, effect) => {
    const amount = resolveEffectNumber(effect.amount);
    if (effect.type !== "resource_delta" || amount >= 0) return cost;
    cost[effect.resource] = (cost[effect.resource] || 0) + Math.abs(amount);
    return cost;
  }, {});
}

export function startWeekend() {
  state.day += 1;
  applyLocationVisibilityDayConditions(state, locations);
  state.flags = {};
  state.activeEventEffects = [];
  state.weekend = {
    active: true,
    completedActivityIds: [],
  };
  state.locationPanelOpen = false;
  state.routePlanner.planning = false;
  addLog("Наступили выходные. Выберите две активности для главного героя.");
  render();
}

export function performWeekendActivity(activityId, partnerId = "") {
  if (!state.weekend?.active) return;

  const activity = activities.find((item) => item.id === activityId);
  const completedActivityIds = state.weekend.completedActivityIds || [];
  if (!activity || completedActivityIds.includes(activity.id)) return;

  const mainAgent = getMainCharacter();
  if (!mainAgent) {
    showToast("Для активности назначьте главного героя в редакторе.");
    return;
  }

  const partnerAgent = activity.kind === "pair" ? state.agents.find((agent) => agent.id === partnerId) : null;
  if (activity.kind === "pair" && (!partnerAgent || partnerAgent.id === mainAgent.id)) {
    showToast("Выберите другого агента в качестве напарника.");
    return;
  }

  const resolvedActivity = resolveActivityEffectAmounts(activity);
  const cost = getWeekendActivityCost(resolvedActivity);
  if (!canAfford(cost)) {
    showToast("Не хватает ресурсов для этой активности.");
    return;
  }

  applyActivityEffects(resolvedActivity, { mainAgent, partnerAgent, agents: state.agents });
  state.weekend.completedActivityIds = [...completedActivityIds, activity.id];
  addLog(`${mainAgent.name}: активность «${activity.name}». ${activity.resultDescription}`);

  if (state.weekend.completedActivityIds.length >= WEEKEND_ACTIVITY_LIMIT) {
    state.weekend.active = false;
    addLog("Выходные завершены. Начинается новая рабочая неделя.");
    startNextDay();
    showToast("Выходные завершены. Наступил понедельник.");
    return;
  }

  state.day += 1;
  applyLocationVisibilityDayConditions(state, locations);
  const calendar = getDayCalendarInfo();
  addLog(`Наступил день ${calendar.day}: ${calendar.weekday}. Выберите ещё одну активность.`);
  render();
}
