import { deepClone } from "./utils.js";

export const FAVOR_FIELD_KEYS = ["name", "cost", "sympathy"];

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

export function normalizeFavorEntry(favor = {}) {
  return {
    name: String(favor.name || "").trim(),
    cost: cloneResourceMap(favor.cost),
    sympathy: normalizeFiniteNumber(favor.sympathy, 0),
  };
}

export function serializeFavor(favor) {
  return normalizeFavorEntry(favor);
}
