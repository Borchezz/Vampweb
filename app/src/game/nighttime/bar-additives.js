import { getActiveComponentProfileId, getIngredients } from "./cocktail-data.js";
import { isBarAdditive } from "./component-inventory.js";

export const BAR_ADDITIVE_SLOT_COUNT = 4;
const STORAGE_KEY = "bloodbar-nighttime-bar-additive-slots";

export function normalizeBarAdditiveSlots(value, ingredients = getIngredients()) {
  const allowed = new Set(ingredients.filter(isBarAdditive).map((ingredient) => ingredient.id));
  const used = new Set();
  return Array.from({ length: BAR_ADDITIVE_SLOT_COUNT }, (_, index) => {
    const id = Array.isArray(value) ? value[index] : "";
    if (!allowed.has(id) || used.has(id)) return "";
    used.add(id);
    return id;
  });
}

export function setBarAdditiveSlot(slots, index, ingredientId, ingredients = getIngredients()) {
  const next = normalizeBarAdditiveSlots(slots, ingredients);
  if (!Number.isInteger(index) || index < 0 || index >= BAR_ADDITIVE_SLOT_COUNT) return next;
  if (!ingredientId) { next[index] = ""; return next; }
  if (!ingredients.some((ingredient) => ingredient.id === ingredientId && isBarAdditive(ingredient))) return next;
  if (next.some((id, slotIndex) => id === ingredientId && slotIndex !== index)) return next;
  next[index] = ingredientId;
  return next;
}

export function loadBarAdditiveSlots(profileId = getActiveComponentProfileId()) {
  try {
    return normalizeBarAdditiveSlots(JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${profileId}`) || "null"));
  } catch {
    return normalizeBarAdditiveSlots(null);
  }
}

export function saveBarAdditiveSlots(slots, profileId = getActiveComponentProfileId()) {
  const normalized = normalizeBarAdditiveSlots(slots);
  try { localStorage.setItem(`${STORAGE_KEY}:${profileId}`, JSON.stringify(normalized)); } catch { /* Session remains playable without browser storage. */ }
  return normalized;
}
