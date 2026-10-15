import { collectLocationMechanicListSchemaErrors, normalizeLocationMechanics } from "./location-mechanic-contract.js";
import { deepClone } from "./utils.js";

export const LOCATION_FIELD_KEYS = Object.freeze([
  "id", "zoneId", "name", "symbol", "accent", "position", "description", "dynamic", "visibilityConditions", "mechanics",
]);

export const LOCATION_VISIBILITY_TRIGGER_OPTIONS = Object.freeze([
  { value: "game_start", label: "Начало игры" },
  { value: "day_number", label: "Номер дня" },
  { value: "weekday", label: "День недели" },
  { value: "task_complete", label: "Задача" },
]);

export const LOCATION_VISIBILITY_ACTION_OPTIONS = Object.freeze([
  { value: "hide", label: "Скрыть" },
  { value: "show", label: "Показать" },
]);

const VISIBILITY_TRIGGER_IDS = new Set(LOCATION_VISIBILITY_TRIGGER_OPTIONS.map((option) => option.value));
const VISIBILITY_ACTION_IDS = new Set(LOCATION_VISIBILITY_ACTION_OPTIONS.map((option) => option.value));

function integer(value, fallback, min, max) {
  const parsed = Math.trunc(Number(value));
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, normalized));
}

export function normalizeLocationVisibilityConditions(conditions = []) {
  if (!Array.isArray(conditions)) return [];
  return conditions.map((condition, index) => ({
    id: typeof condition?.id === "string" && condition.id.trim() ? condition.id : `visibility-${index + 1}`,
    trigger: VISIBILITY_TRIGGER_IDS.has(condition?.trigger) ? condition.trigger : "game_start",
    action: VISIBILITY_ACTION_IDS.has(condition?.action) ? condition.action : "hide",
    day: integer(condition?.day, 1, 1, Number.MAX_SAFE_INTEGER),
    weekday: integer(condition?.weekday, 0, 0, 6),
    taskId: typeof condition?.taskId === "string" ? condition.taskId : "",
  }));
}

export function normalizeLocationEntry(location = {}) {
  const normalizedLocation = deepClone(location);
  delete normalizedLocation.availableFrom;
  delete normalizedLocation.visible;
  return {
    ...normalizedLocation,
    visibilityConditions: normalizeLocationVisibilityConditions(location.visibilityConditions),
    mechanics: normalizeLocationMechanics(location.mechanics),
  };
}

export function serializeLocation(location = {}) {
  return normalizeLocationEntry(location);
}

export function collectLocationMechanicsSchemaErrors(location, context = "location") {
  return collectLocationMechanicListSchemaErrors(location?.mechanics, `${context}.mechanics`);
}

export function collectLocationVisibilitySchemaErrors(location, context = "location") {
  const errors = [];
  if (location.visibilityConditions === undefined) return errors;
  if (!Array.isArray(location.visibilityConditions)) {
    errors.push(`${context}.visibilityConditions must be an array`);
    return errors;
  }
  const ids = new Set();
  location.visibilityConditions.forEach((condition, index) => {
    const itemContext = `${context}.visibilityConditions[${index}]`;
    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
      errors.push(`${itemContext} must be an object`);
      return;
    }
    const allowedKeys = new Set(["id", "trigger", "action", "day", "weekday", "taskId"]);
    Object.keys(condition).forEach((key) => {
      if (!allowedKeys.has(key)) errors.push(`${itemContext} has unexpected key: ${key}`);
    });
    if (typeof condition.id !== "string" || !condition.id.trim()) errors.push(`${itemContext}.id must be a non-empty string`);
    if (ids.has(condition.id)) errors.push(`${itemContext}.id duplicates visibility condition id: ${condition.id}`);
    ids.add(condition.id);
    if (!VISIBILITY_TRIGGER_IDS.has(condition.trigger)) errors.push(`${itemContext}.trigger is invalid`);
    if (!VISIBILITY_ACTION_IDS.has(condition.action)) errors.push(`${itemContext}.action is invalid`);
    if (condition.trigger === "day_number" && (!Number.isInteger(Number(condition.day)) || Number(condition.day) < 1)) {
      errors.push(`${itemContext}.day must be a positive integer`);
    }
    if (condition.trigger === "weekday" && (!Number.isInteger(Number(condition.weekday)) || Number(condition.weekday) < 0 || Number(condition.weekday) > 6)) {
      errors.push(`${itemContext}.weekday must be between 0 and 6`);
    }
    if (condition.trigger === "task_complete" && (typeof condition.taskId !== "string" || !condition.taskId.trim())) {
      errors.push(`${itemContext}.taskId must be a non-empty string`);
    }
  });
  return errors;
}
