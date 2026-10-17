import { COCKTAIL_SLOT_CONFIG, TAG_DEFINITIONS, getIngredientById, tagSupportsDegree } from "./cocktail-data.js";
// Kept for callers that imported the old constant; cocktail degrees are unbounded.
export const MAX_TAG_DEGREE = Infinity;
const BLOOD_GROUP_BY_TAG_ID = { bloodO: "O", bloodA: "A", bloodB: "B", bloodAB: "AB" };
const COMPATIBLE_ERYTHROCYTE_GROUPS_BY_PLASMA_GROUP = {
  O: ["O"],
  A: ["O", "A"],
  B: ["O", "B"],
  AB: ["O", "A", "B", "AB"],
};
function addTag(tags, tagId, degree) {
  const definition = TAG_DEFINITIONS[tagId];
  if (!definition || !Number.isFinite(degree) || degree === 0 || (degree < 0 && !tags.has(tagId))) return;
  const current = tags.get(tagId) || { ...definition, degree: 0 };
  const sum = current.degree + degree;
  current.degree = Math.max(0, tagSupportsDegree(tagId) ? sum : Math.min(1, sum));
  if (current.degree <= 0) current.suppressed = true;
  else delete current.suppressed;
  tags.set(tagId, current);
}
function isActive(entry) {
  return Boolean(entry && !entry.suppressed && (entry.degree ?? 1) > 0);
}
function addSignedTags(tags, contributions) {
  // Positive sources must exist before subtraction; negative-only tags stay absent.
  contributions.filter((tag) => tag.degree > 0).forEach((tag) => addTag(tags, tag.id, tag.degree));
  contributions.filter((tag) => tag.degree < 0).forEach((tag) => addTag(tags, tag.id, tag.degree));
}
function suppressTag(tags, id) {
  if (tags.has(id)) Object.assign(tags.get(id), { degree: 0, suppressed: true });
}
function ingredientLookup(context) {
  return context.ingredients ? (id) => context.ingredients.find((entry) => entry.id === id) : getIngredientById;
}
function isBarAdditive(ingredient) {
  return ingredient?.type === "additive" && ingredient.additiveCategory === "bar";
}
export function getAvailableSlot(slots, ingredient, context = {}) {
  if (ingredient.type === "additive" && Object.values(slots).includes(ingredient.id)) return null;
  const lookup = ingredientLookup(context);
  if (isBarAdditive(ingredient) && COCKTAIL_SLOT_CONFIG.some((slot) => slot.accepts.includes("additive") && isBarAdditive(lookup(slots[slot.id])))) return null;
  return COCKTAIL_SLOT_CONFIG.find((slot) => slot.accepts.includes(ingredient.type) && !slots[slot.id]) || null;
}
function resolveRecipe(slots, context) {
  const lookup = ingredientLookup(context);
  const entries = [];
  const validationErrors = [];
  const additiveIds = new Set();
  let hasBarAdditive = false;
  for (const slot of COCKTAIL_SLOT_CONFIG) {
    const ingredient = lookup(slots[slot.id]);
    if (!ingredient) continue;
    let code;
    if (ingredient.type === "additive" && additiveIds.has(ingredient.id)) code = "duplicate-additive";
    else if (isBarAdditive(ingredient) && hasBarAdditive) code = "bar-additive-limit";
    if (code) {
      validationErrors.push({ code, slotId: slot.id, ingredientId: ingredient.id });
      continue;
    }
    if (ingredient.type === "additive") additiveIds.add(ingredient.id);
    if (isBarAdditive(ingredient)) hasBarAdditive = true;
    entries.push({ slotId: slot.id, ingredient });
  }
  return { entries, validationErrors };
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
function cachedPreferenceIndex(effect, candidates, context) {
  const choices = context.randomChoices || {};
  if (!Object.hasOwn(choices, effect.key)) {
    choices[effect.key] = candidates.length ? candidates[Math.floor((context.random || Math.random)() * candidates.length)] : null;
  }
  // Keep null and now-ineligible targets too; a rebuild must never reroll a key.
  return choices[effect.key];
}
function preferredTagOrder(effect, profile, context) {
  const key = `${effect.key}:priority`;
  const choices = context.randomChoices || {};
  if (!Object.hasOwn(choices, key)) {
    const order = [...new Set((context.profile?.preferences || profile?.preferences || [])
      .filter((entry) => entry.attitude > 0 && TAG_DEFINITIONS[entry.tagId] && tagSupportsDegree(entry.tagId))
      .map((entry) => entry.tagId))].sort();
    for (let index = order.length - 1; index > 0; index--) {
      const other = Math.floor((context.random || Math.random)() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    choices[key] = order;
  }
  return choices[key];
}

function applyPreferredTagBoosts(effects, tags, profile, context) {
  const desiredDegrees = new Map();
  for (const preference of profile?.preferences || []) {
    if (!isActive(preference) || preference.attitude <= 0 || !tagSupportsDegree(preference.tagId)) continue;
    desiredDegrees.set(preference.tagId, Math.max(desiredDegrees.get(preference.tagId) || 0, preference.degree ?? 1));
  }
  for (const effect of effects.filter((entry) => entry.type === "preferred_tag_boost")) {
    const order = preferredTagOrder(effect, profile, context);
    let remaining = Number.isInteger(effect.units) && effect.units > 0 ? effect.units : 0;
    while (remaining > 0) {
      let improved = false;
      for (const id of order) {
        const tag = tags.get(id);
        if (!isActive(tag) || tag.degree >= (desiredDegrees.get(id) || 0)) continue;
        addTag(tags, id, Math.min(1, desiredDegrees.get(id) - tag.degree));
        remaining--;
        improved = true;
        if (!remaining) break;
      }
      if (!improved) break;
    }
  }
}

function applyPreferenceShifts(effects, profile, context) {
  const preferences = profile?.preferences || [];
  for (const effect of effects.filter((entry) => entry.type === "preference_shift")) {
    const candidates = preferences.flatMap((preference, index) =>
      isActive(preference) && effect.attitudes.includes(preference.attitude)
        && (effect.amount <= 0 || tagSupportsDegree(preference.tagId)) ? [index] : []);
    const index = cachedPreferenceIndex(effect, candidates, context);
    if (index === null || !candidates.includes(index)) continue;
    const preference = preferences[index];
    preference.originalDegree ??= preference.degree ?? 1;
    preference.degree = Math.max(0, (preference.degree ?? 1) + effect.amount);
    if (preference.degree <= 0) preference.suppressed = true;
  }
}
/**
 * Input profile/catalog are never edited; only caller-owned randomChoices is updated.
 * Keys: `${ingredientId}:${effectIndex}` -> source preference index/null.
 * Choices belong to one client visit, independent of recipe slots or resets.
 *
 * Order: signed sources -> derived/preparation tags -> blood preference suppression
 * -> preference shifts -> forced consistency -> multipliers -> desired tags
 * -> blood/hemolysis neutralization -> shared conditional snapshot and signed changes.
 * Satisfaction adjustments are independent and returned separately.
 */
export function buildCocktail(slots, preparation = {}, context = {}) {
  const { entries, validationErrors } = resolveRecipe(slots, context);
  const ingredients = entries.map((entry) => entry.ingredient);
  const tags = new Map();
  addSignedTags(tags, ingredients.flatMap((entry) => entry.tags));
  const large = ingredients.filter((entry) => entry.type === "plasma" || entry.type === "erythrocytes");
  const plasmaCount = large.filter((entry) => entry.type === "plasma").length;
  const erythrocyteCount = large.filter((entry) => entry.type === "erythrocytes").length;
  const bloodConflicts = countBloodConflicts(large);
  if (plasmaCount > erythrocyteCount) addTag(tags, "liquid", 1);
  if (erythrocyteCount > plasmaCount) addTag(tags, "thick", 1);
  if (bloodConflicts) addTag(tags, "hemolysis", bloodConflicts + (preparation.mixed ? 1 : 0));
  if (preparation.cold) addTag(tags, "cold", 1);
  if (preparation.warm) addTag(tags, "warm", 1);
  if (ingredients.length > 1) addTag(tags, preparation.mixed ? "mixed" : "layered", 1);
  const effects = entries.flatMap(({ ingredient }) => (ingredient.effects || []).map((effect, effectIndex) => ({ ...effect, key: `${ingredient.id}:${effectIndex}` })));
  const effectiveProfile = context.profile ? { ...context.profile, preferences: (context.profile.preferences || []).map((entry) => ({ ...entry })) } : null;
  if (effects.some((effect) => effect.type === "ignore_blood_preferences")) {
    for (const preference of effectiveProfile?.preferences || []) {
      if (!BLOOD_GROUP_BY_TAG_ID[preference.tagId]) continue;
      preference.originalDegree ??= preference.degree ?? 1;
      preference.degree = 0;
      preference.suppressed = true;
    }
  }
  applyPreferenceShifts(effects, effectiveProfile, context);
  if (effects.some((effect) => effect.type === "force_thick")) {
    addTag(tags, "thick", 1);
    suppressTag(tags, "liquid");
  }
  for (const effect of effects.filter((entry) => entry.type === "tag_multiply")) {
    const current = tags.get(effect.tagId);
    if (isActive(current)) addTag(tags, effect.tagId, current.degree * (effect.factor - 1));
    else addTag(tags, effect.tagId, effect.fallback);
  }
  for (const effect of effects.filter((entry) => entry.type === "desired_tag")) {
    const preferences = effectiveProfile?.preferences || [];
    const eligible = preferences.flatMap((preference, index) =>
      isActive(preference) && preference.attitude > 0 && effect.tagIds.includes(preference.tagId) ? [index] : []);
    const strongest = Math.max(0, ...eligible.map((index) => preferences[index].attitude));
    const candidates = eligible.filter((index) => preferences[index].attitude === strongest);
    let index = cachedPreferenceIndex(effect, candidates, context);
    // Unlike random wish shifts, desired properties follow the currently strongest
    // active wish. If another additive suppresses it, use the remaining candidate
    // without a new random roll; a valid cached tie choice remains stable.
    if (!candidates.includes(index) && candidates.length) {
      index = candidates[0];
    }
    if (index !== null && candidates.includes(index)) addTag(tags, preferences[index].tagId, effect.amount);
  }
  if (effects.some((effect) => effect.type === "blood_neutralize")) {
    for (const id of [...Object.keys(BLOOD_GROUP_BY_TAG_ID), "hemolysis"]) {
      suppressTag(tags, id);
    }
  }
  applyPreferredTagBoosts(effects, tags, effectiveProfile, context);
  const conditionalSnapshot = new Set([...tags.values()].filter(isActive).map((entry) => entry.id));
  const conditionalChanges = effects.filter((effect) => effect.type === "conditional_tag"
    && (effectiveProfile?.preferences || []).some((preference) => isActive(preference)
      && preference.attitude === effect.attitude && conditionalSnapshot.has(preference.tagId)));
  // Every condition observes the same snapshot; opposing changes can cancel.
  addSignedTags(tags, conditionalChanges.map((effect) => ({ id: effect.tagId, degree: effect.amount })));
  const satisfactionModifier = effects.filter((effect) => effect.type === "satisfaction").reduce((sum, effect) => sum + effect.amount, 0);
  return { ingredients, tags: [...tags.values()], isComplete: large.length > 0, valid: validationErrors.length === 0, validationErrors, effectiveProfile, satisfactionModifier };
}
