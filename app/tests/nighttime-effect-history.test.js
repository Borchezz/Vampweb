import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
const { buildCocktail } = await import("../src/game/nighttime/cocktail-rules.js");
const { removeCocktailIngredient } = await import("../src/game/nighttime/recipe-session.js");
const tagDegree = (cocktail, id) => cocktail.tags.find((tag) => tag.id === id)?.degree ?? 0;

test("cortisol follows the strongest remaining wish after adrenaline suppresses its original target", () => {
  const profile = { preferences: [{ tagId: "healing", attitude: 2, degree: 1 }, { tagId: "potential", attitude: 1, degree: 1 }] };
  const choices = {};
  const context = { profile, randomChoices: choices, random: () => 0 };
  const slots = { "base-1": "plasma-o", "additive-1": "additive-cortisol" };
  assert.equal(tagDegree(buildCocktail(slots, {}, context), "healing"), 1);
  slots["additive-2"] = "additive-adrenaline";
  const combined = buildCocktail(slots, {}, context);
  assert.equal(combined.effectiveProfile.preferences[0].suppressed, true);
  assert.equal(tagDegree(combined, "potential"), 1, "Cortisol still grants a useful property instead of becoming a no-op");
  delete slots["additive-2"];
  assert.equal(tagDegree(buildCocktail(slots, {}, context), "healing"), 1);
});

test("cortisol restores its tied visit choice after a temporary adrenaline fallback", () => {
  const profile = { preferences: [{ tagId: "healing", attitude: 2, degree: 1 }, { tagId: "potential", attitude: 2, degree: 1 }] };
  const choices = {};
  let rolls = 0;
  const context = { profile, randomChoices: choices, random: () => { rolls++; return 0; } };
  const slots = { "base-1": "plasma-o", "additive-1": "additive-cortisol" };
  const initial = buildCocktail(slots, {}, context);
  assert.equal(tagDegree(initial, "healing"), 1);
  assert.equal(tagDegree(initial, "potential"), 0);
  assert.equal(choices["additive-cortisol:0"], 0);

  slots["additive-2"] = "additive-adrenaline";
  const combined = buildCocktail(slots, {}, context);
  assert.equal(combined.effectiveProfile.preferences[0].suppressed, true);
  assert.equal(tagDegree(combined, "potential"), 1);
  assert.equal(choices["additive-cortisol:0"], 0, "A temporary fallback must not replace the visit choice");

  delete slots["additive-2"];
  const restored = buildCocktail(slots, {}, context);
  assert.equal(tagDegree(restored, "healing"), 1);
  assert.equal(tagDegree(restored, "potential"), 0);
  assert.equal(choices["additive-cortisol:0"], 0);
  assert.equal(rolls, 2, "Cortisol and adrenaline each roll once for the visit");
});

test("removing adrenaline preserves nectar's client-scoped priority and boosts only the drink", () => {
  const profile = { preferences: [{ tagId: "healing", attitude: 1, degree: 1 }, { tagId: "potential", attitude: 2, degree: 2 }] };
  let rolls = 0;
  const state = { slots: { "base-1": "erythrocytes-ab", "additive-1": "additive-adrenaline" }, randomChoices: {}, prepared: false };
  const context = { profile, randomChoices: state.randomChoices, random: () => { rolls++; return 0; } };
  buildCocktail(state.slots, {}, context);
  state.slots["additive-2"] = "additive-nectar";
  let cocktail = buildCocktail(state.slots, {}, context);
  assert.equal(cocktail.effectiveProfile.preferences[1].degree, 2);
  assert.equal(tagDegree(cocktail, "potential"), 2);
  removeCocktailIngredient(state, "additive-1");
  cocktail = buildCocktail(state.slots, {}, context);
  assert.equal(cocktail.effectiveProfile.preferences[0].degree, 1);
  assert.equal(cocktail.effectiveProfile.preferences[1].degree, 2);
  assert.equal(tagDegree(cocktail, "potential"), 2);
  state.slots["additive-1"] = "additive-melatonin";
  assert.equal(tagDegree(buildCocktail(state.slots, {}, context), "potential"), 2);
  assert.equal(rolls, 2);
});

test("serotonin does not reroll when EPO temporarily excludes its cached blood wish", () => {
  const profile = { preferences: [{ tagId: "bloodO", attitude: -1 }, { tagId: "sour", attitude: -1, degree: 2 }] };
  let rolls = 0;
  const slots = { "base-1": "plasma-o", "additive-1": "additive-serotonin" };
  const context = { profile, randomChoices: {}, random: () => { rolls++; return 0; } };
  buildCocktail(slots, {}, context);
  slots["additive-2"] = "additive-epo";
  const combined = buildCocktail(slots, {}, context);
  assert.equal(combined.effectiveProfile.preferences[0].suppressed, true);
  assert.equal(combined.effectiveProfile.preferences[1].degree, 2);
  delete slots["additive-2"];
  assert.equal(buildCocktail(slots, {}, context).effectiveProfile.preferences[0].suppressed, true);
  assert.equal(rolls, 1);
});
