import { deepClone } from "./utils.js";
import { cloneTaskEffectList } from "./task-effect-registry.js";

export const TASK_FIELD_KEYS = [
  "id",
  "locationId",
  "name",
  "kind",
  "stat",
  "difficulty",
  "difficultyLevelId",
  "maxPerDay",
  "description",
  "costResources",
  "rewards",
  "success",
  "failure",
  "costEffects",
  "rewardEffects",
  "successEffects",
  "failureEffects",
];

export const RUNTIME_TASK_FIELD_KEYS = [...TASK_FIELD_KEYS];

export const TASK_KIND_OPTIONS = ["check", "trade", "opportunity"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneResourceMap(value) {
  return isPlainObject(value) ? deepClone(value) : {};
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeTaskStat(stat) {
  return stat === "mind" ? "intelligence" : stat;
}

export function normalizeTaskEntry(savedTask = {}, options = {}) {
  const maxPerDay = Number(savedTask.maxPerDay);
  return {
    id: savedTask.id || options.fallbackId || "task",
    locationId: savedTask.locationId || options.fallbackLocationId || "",
    name: savedTask.name ?? "Новая задача",
    kind: savedTask.kind || "check",
    stat: normalizeTaskStat(savedTask.stat ?? ""),
    difficulty: normalizeFiniteNumber(savedTask.difficulty, 0),
    difficultyLevelId: typeof savedTask.difficultyLevelId === "string" ? savedTask.difficultyLevelId : "",
    maxPerDay: Number.isFinite(maxPerDay) ? maxPerDay : 1,
    description: savedTask.description ?? "",
    costResources: cloneResourceMap(savedTask.costResources),
    rewards: cloneResourceMap(savedTask.rewards),
    success: cloneResourceMap(savedTask.success),
    failure: cloneResourceMap(savedTask.failure),
    costEffects: cloneTaskEffectList(savedTask.costEffects),
    rewardEffects: cloneTaskEffectList(savedTask.rewardEffects),
    successEffects: cloneTaskEffectList(savedTask.successEffects),
    failureEffects: cloneTaskEffectList(savedTask.failureEffects),
  };
}

export function applyTaskFields(task, savedTask = {}) {
  if (Object.prototype.hasOwnProperty.call(savedTask, "locationId")) task.locationId = savedTask.locationId || task.locationId;
  if (Object.prototype.hasOwnProperty.call(savedTask, "name")) task.name = savedTask.name ?? "";
  if (Object.prototype.hasOwnProperty.call(savedTask, "kind")) task.kind = savedTask.kind || task.kind;
  if (Object.prototype.hasOwnProperty.call(savedTask, "stat")) task.stat = normalizeTaskStat(savedTask.stat ?? "");
  if (Object.prototype.hasOwnProperty.call(savedTask, "difficulty")) task.difficulty = normalizeFiniteNumber(savedTask.difficulty, 0);
  if (Object.prototype.hasOwnProperty.call(savedTask, "difficultyLevelId")) task.difficultyLevelId = typeof savedTask.difficultyLevelId === "string" ? savedTask.difficultyLevelId : "";
  if (Object.prototype.hasOwnProperty.call(savedTask, "maxPerDay")) {
    const maxPerDay = Number(savedTask.maxPerDay);
    task.maxPerDay = Number.isFinite(maxPerDay) ? maxPerDay : 1;
  }
  if (Object.prototype.hasOwnProperty.call(savedTask, "description")) task.description = savedTask.description ?? "";
  if (Object.prototype.hasOwnProperty.call(savedTask, "costResources")) task.costResources = cloneResourceMap(savedTask.costResources);
  if (Object.prototype.hasOwnProperty.call(savedTask, "rewards")) task.rewards = cloneResourceMap(savedTask.rewards);
  if (isPlainObject(savedTask.success)) task.success = deepClone(savedTask.success);
  if (isPlainObject(savedTask.failure)) task.failure = deepClone(savedTask.failure);
  if (Object.prototype.hasOwnProperty.call(savedTask, "costEffects")) task.costEffects = cloneTaskEffectList(savedTask.costEffects);
  if (Object.prototype.hasOwnProperty.call(savedTask, "rewardEffects")) task.rewardEffects = cloneTaskEffectList(savedTask.rewardEffects);
  if (Object.prototype.hasOwnProperty.call(savedTask, "successEffects")) task.successEffects = cloneTaskEffectList(savedTask.successEffects);
  if (Object.prototype.hasOwnProperty.call(savedTask, "failureEffects")) task.failureEffects = cloneTaskEffectList(savedTask.failureEffects);
  task.stat = normalizeTaskStat(task.stat ?? "");
  return task;
}

export function serializeTask(task) {
  return {
    id: task.id,
    locationId: task.locationId,
    name: task.name,
    kind: task.kind,
    stat: normalizeTaskStat(task.stat || ""),
    difficulty: task.difficulty || 0,
    difficultyLevelId: typeof task.difficultyLevelId === "string" ? task.difficultyLevelId : "",
    maxPerDay: typeof task.maxPerDay === "number" ? task.maxPerDay : 1,
    description: task.description || "",
    costResources: cloneResourceMap(task.costResources),
    rewards: cloneResourceMap(task.rewards),
    success: isPlainObject(task.success) ? deepClone(task.success) : null,
    failure: isPlainObject(task.failure) ? deepClone(task.failure) : null,
    costEffects: cloneTaskEffectList(task.costEffects),
    rewardEffects: cloneTaskEffectList(task.rewardEffects),
    successEffects: cloneTaskEffectList(task.successEffects),
    failureEffects: cloneTaskEffectList(task.failureEffects),
  };
}
