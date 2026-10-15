import { COCKTAIL_SLOT_CONFIG, TAG_DEFINITIONS, getIngredientById } from "./cocktail-data.js";
export const MAX_TAG_DEGREE = 3;
const BLOOD_GROUP_BY_TAG_ID = { bloodO: "O", bloodA: "A", bloodB: "B", bloodAB: "AB" };
const COMPATIBLE_ERYTHROCYTE_GROUPS_BY_PLASMA_GROUP = {
  O: ["O"],
  A: ["O", "A"],
  B: ["O", "B"],
  AB: ["O", "A", "B", "AB"],
};
function addTag(tags, tagId, degree) { const definition = TAG_DEFINITIONS[tagId]; if (!definition) return; const current = tags.get(tagId) || { ...definition, degree: 0 }; const maxDegree = tagId === "hemolysis" ? 2 : MAX_TAG_DEGREE; current.degree = Math.min(maxDegree, current.degree + degree); tags.set(tagId, current); }
export function getAvailableSlot(slots, ingredient) {
  if (ingredient.type === "additive" && Object.values(slots).includes(ingredient.id)) return null;
  return COCKTAIL_SLOT_CONFIG.find((slot) => slot.accepts.includes(ingredient.type) && !slots[slot.id]) || null;
}
function getBloodGroup(entry) { return entry.tags.map((tag) => BLOOD_GROUP_BY_TAG_ID[tag.id]).find(Boolean) || null; }
function countBloodConflicts(largeIngredients) {
  const plasmas = largeIngredients.filter((entry) => entry.type === "plasma");
  const erythrocytes = largeIngredients.filter((entry) => entry.type === "erythrocytes");
  return plasmas.reduce((count, plasma) => {
    const compatibleGroups = COMPATIBLE_ERYTHROCYTE_GROUPS_BY_PLASMA_GROUP[getBloodGroup(plasma)] || [];
    return count + erythrocytes.filter((erythrocytesEntry) => !compatibleGroups.includes(getBloodGroup(erythrocytesEntry))).length;
  }, 0);
}
export function buildCocktail(slots, preparation = {}) {
  const ingredients = Object.values(slots).map(getIngredientById).filter(Boolean); const tags = new Map();
  ingredients.forEach((entry) => entry.tags.forEach((tag) => addTag(tags, tag.id, tag.degree)));
  const large = ingredients.filter((entry) => entry.type === "plasma" || entry.type === "erythrocytes"); const plasmaCount = ingredients.filter((entry) => entry.type === "plasma").length; const erythrocyteCount = ingredients.filter((entry) => entry.type === "erythrocytes").length;
  const bloodConflicts = countBloodConflicts(large);
  if (plasmaCount > erythrocyteCount) addTag(tags, "liquid", 1);
  if (erythrocyteCount > plasmaCount) addTag(tags, "thick", 1);
  if (bloodConflicts) addTag(tags, "hemolysis", bloodConflicts + (preparation.mixed ? 1 : 0));
  if (preparation.cold) addTag(tags, "cold", 1);
  if (preparation.warm) addTag(tags, "warm", 1);
  if (ingredients.length > 1) addTag(tags, preparation.mixed ? "mixed" : "layered", 1);
  return { ingredients, tags: [...tags.values()], isComplete: large.length > 0 };
}
