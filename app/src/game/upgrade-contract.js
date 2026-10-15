import { deepClone } from "./utils.js";
import { normalizeUpgradeEffectList } from "./upgrade-effect-registry.js";

export const UPGRADE_FIELD_KEYS = ["id", "name", "cost", "description", "buyEffects"];
export const RUNTIME_UPGRADE_FIELD_KEYS = [...UPGRADE_FIELD_KEYS];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneResourceMap(value) {
  return isPlainObject(value) ? deepClone(value) : {};
}

export function normalizeUpgradeEntry(upgrade = {}, fallbackId = "upgrade") {
  return {
    id: String(upgrade.id || fallbackId).trim(),
    name: String(upgrade.name || upgrade.id || fallbackId).trim(),
    cost: cloneResourceMap(upgrade.cost),
    description: String(upgrade.description || "").trim(),
    buyEffects: normalizeUpgradeEffectList(upgrade.buyEffects),
  };
}

export function serializeUpgrade(upgrade) {
  return normalizeUpgradeEntry(upgrade, upgrade?.id || "upgrade");
}
