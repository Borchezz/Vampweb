import { deepClone } from "./utils.js";

const LEGACY_RESOURCE_IDS = {
  rawBlood: "bloodTier1",
};
const REMOVED_RESOURCE_IDS = new Set(["cocktails"]);

function migrateValue(value) {
  if (Array.isArray(value)) return value.map(migrateValue).filter((item) => item !== null);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? LEGACY_RESOURCE_IDS[value] || value : value;
  }

  if (REMOVED_RESOURCE_IDS.has(value.resource)) return null;

  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (key === "specialties" || REMOVED_RESOURCE_IDS.has(key)) return result;
    const migratedKey = LEGACY_RESOURCE_IDS[key] || key;
    // A current key must win when a profile contains both the legacy and new form.
    if (Object.hasOwn(result, migratedKey) && migratedKey !== key) return result;
    result[migratedKey] = migrateValue(nestedValue);
    return result;
  }, {});
}

export function migrateEditorConfig(config) {
  return migrateValue(deepClone(config)) || {};
}
