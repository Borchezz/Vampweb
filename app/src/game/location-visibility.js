import { normalizeLocationVisibilityConditions } from "./location-contract.js";

function getDefaultVisibility(location) {
  return Boolean(location);
}

function getStoredVisibility(targetState, location) {
  const stored = targetState.locationVisibility?.[location.id];
  return typeof stored === "boolean" ? stored : getDefaultVisibility(location);
}

function conditionMatches(condition, context) {
  if (condition.trigger === "game_start") return context.trigger === "game_start";
  if (condition.trigger === "day_number") return context.trigger === "day" && condition.day === context.day;
  if (condition.trigger === "weekday") return context.trigger === "day" && condition.weekday === context.weekday;
  if (condition.trigger === "task_complete") return context.trigger === "task_complete" && condition.taskId === context.taskId;
  return false;
}

function applyConditions(targetState, locations, context) {
  targetState.locationVisibility ||= {};
  locations.forEach((location) => {
    let visible = getStoredVisibility(targetState, location);
    normalizeLocationVisibilityConditions(location.visibilityConditions).forEach((condition) => {
      if (conditionMatches(condition, context)) visible = condition.action === "show";
    });
    targetState.locationVisibility[location.id] = visible;
  });
}

export function initializeLocationVisibility(targetState, locations = []) {
  targetState.locationVisibility = Object.fromEntries(locations.map((location) => [location.id, getDefaultVisibility(location)]));
  applyConditions(targetState, locations, { trigger: "game_start" });
}

export function applyLocationVisibilityDayConditions(targetState, locations = [], day = targetState.day) {
  const normalizedDay = Math.max(1, Math.trunc(Number(day) || 1));
  applyConditions(targetState, locations, {
    trigger: "day",
    day: normalizedDay,
    weekday: (normalizedDay - 1) % 7,
  });
}

export function applyLocationVisibilityTaskConditions(targetState, locations = [], taskId) {
  if (!taskId) return;
  applyConditions(targetState, locations, { trigger: "task_complete", taskId });
}

export function isLocationVisible(location, targetState = {}) {
  if (!location) return false;
  return getStoredVisibility(targetState, location);
}
