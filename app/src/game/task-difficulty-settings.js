import { deepClone } from "./utils.js";

export const DEFAULT_TASK_DIFFICULTY_LEVELS = [
  { id: "easy", name: "Легко", value: 7 },
  { id: "normal", name: "Нормально", value: 8 },
  { id: "hard", name: "Сложно", value: 9 },
  { id: "impossible", name: "Невозможно", value: 10 },
];

export const TASK_DIFFICULTY_LEVEL_LIMITS = { min: 1, max: 12 };

function normalizeDifficultyId(value, fallback) {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || fallback;
}

function normalizeDifficultyValue(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function normalizeTaskDifficultyLevels(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_TASK_DIFFICULTY_LEVELS;
  const length = Math.max(TASK_DIFFICULTY_LEVEL_LIMITS.min, Math.min(TASK_DIFFICULTY_LEVEL_LIMITS.max, source.length));
  const usedIds = new Set();

  return Array.from({ length }, (_, index) => {
    const fallback = DEFAULT_TASK_DIFFICULTY_LEVELS[index] || {
      id: `difficulty-${index + 1}`,
      name: `Сложность ${index + 1}`,
      value: index + 7,
    };
    const sourceLevel = source[index] || fallback;
    let id = normalizeDifficultyId(sourceLevel.id, fallback.id);
    if (usedIds.has(id)) id = `difficulty-${index + 1}`;
    usedIds.add(id);
    const name = String(sourceLevel.name ?? fallback.name).trim() || fallback.name;
    return { id, name, value: normalizeDifficultyValue(sourceLevel.value, fallback.value) };
  });
}

export function cloneTaskDifficultyLevels(levels = DEFAULT_TASK_DIFFICULTY_LEVELS) {
  return deepClone(normalizeTaskDifficultyLevels(levels));
}

export function getTaskDifficultyLevel(levels, difficultyLevelId, legacyValue = 0) {
  const normalizedLevels = normalizeTaskDifficultyLevels(levels);
  const selected = normalizedLevels.find((level) => level.id === String(difficultyLevelId || ""));
  if (selected) return selected;
  return normalizedLevels.find((level) => level.value === Number(legacyValue)) || null;
}

export function getTaskDifficultyValue(task, levels) {
  const level = getTaskDifficultyLevel(levels, task?.difficultyLevelId, task?.difficulty);
  return level ? level.value : Number(task?.difficulty) || 0;
}

export function getTaskDifficultyLabel(task, levels) {
  const level = getTaskDifficultyLevel(levels, task?.difficultyLevelId, task?.difficulty);
  if (level) return `${level.name} (${level.value})`;
  const value = Number(task?.difficulty) || 0;
  return value ? `Сложность (${value})` : "Без сложности";
}

export function getTaskDifficultyOptions(levels, task) {
  const normalizedLevels = normalizeTaskDifficultyLevels(levels);
  const selected = getTaskDifficultyLevel(normalizedLevels, task?.difficultyLevelId, task?.difficulty);
  return {
    options: normalizedLevels.map((level) => ({ value: level.id, label: `${level.name} (${level.value})` })),
    selectedId: selected?.id || normalizedLevels[0].id,
  };
}
