// Declarative data only: neither catalog normalization nor the editor executes effects.
const isInteger = (value) => Number.isFinite(value) && Number.isInteger(value);
const isAttitude = (value) => isInteger(value) && value >= -2 && value <= 2;
const isId = (value) => typeof value === "string" && value.trim().length > 0;
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

function isJsonData(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = Object.entries(value).every(([key, entry]) => !forbiddenKeys.has(key) && isJsonData(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

export function isValidAdditiveEffect(effect) {
  if (!effect || Array.isArray(effect) || !isId(effect.type) || !isJsonData(effect)) return false;
  switch (effect.type) {
    case "preferred_tag_boost":
      return isInteger(effect.units) && effect.units > 0;
    case "preference_shift":
      return Array.isArray(effect.attitudes) && effect.attitudes.length > 0 && effect.attitudes.every(isAttitude) && isInteger(effect.amount);
    case "tag_multiply":
      return isId(effect.tagId) && Number.isFinite(effect.factor) && effect.factor > 0 && isInteger(effect.fallback);
    case "satisfaction":
      return isInteger(effect.amount);
    case "desired_tag":
      return Array.isArray(effect.tagIds) && effect.tagIds.length > 0 && effect.tagIds.every(isId) && isInteger(effect.amount);
    case "conditional_tag":
      return isAttitude(effect.attitude) && isId(effect.tagId) && isInteger(effect.amount);
    case "blood_neutralize":
    case "ignore_blood_preferences":
    case "force_thick":
      return true;
    default:
      // Preserve future declarative effect types during an older editor's round trip.
      return true;
  }
}

export function normalizeAdditiveEffects(value) {
  return Array.isArray(value) ? value.filter(isValidAdditiveEffect).map((effect) => JSON.parse(JSON.stringify(effect))) : [];
}
