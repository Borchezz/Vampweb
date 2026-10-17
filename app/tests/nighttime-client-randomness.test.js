import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
const { buildCocktail } = await import("../src/game/nighttime/cocktail-rules.js");
const { clearCocktail, removeCocktailIngredient } = await import("../src/game/nighttime/recipe-session.js");
const session = await import("../src/game/nighttime/recipe-session.js");

test("only starting a new client visit clears random choices", () => {
  assert.equal(typeof session.startClientVisit, "function");
  const state = { slots: { "additive-1": "additive-serotonin" }, preparation: { cold: true }, prepared: true, randomChoices: { "additive-serotonin:0": 1 }, barSlots: ["additive-olive"] };
  const client = { id: "next", preferences: [] };
  session.startClientVisit(state, client);
  assert.equal(state.clientProfile, client);
  assert.deepEqual(state.randomChoices, {});
  assert.deepEqual(state.slots, {});
  assert.deepEqual(state.barSlots, ["additive-olive"]);
  assert.equal(state.prepared, false);
});

test("removing and readding a random additive in another slot cannot reroll for the same client", () => {
  const state = { slots: { "base-1": "plasma-o", "additive-1": "additive-serotonin" }, randomChoices: {} };
  const profile = { preferences: [{ tagId: "sour", attitude: -1, degree: 1 }, { tagId: "bitter", attitude: -2, degree: 1 }] };
  let rolls = 0;
  const context = { profile, randomChoices: state.randomChoices, random: () => rolls++ === 0 ? 0 : .99 };
  const first = buildCocktail(state.slots, {}, context);
  const target = first.effectiveProfile.preferences.findIndex((entry) => entry.suppressed);
  removeCocktailIngredient(state, "additive-1");
  state.slots["additive-2"] = "additive-serotonin";
  const second = buildCocktail(state.slots, {}, { ...context, randomChoices: state.randomChoices });
  assert.equal(second.effectiveProfile.preferences.findIndex((entry) => entry.suppressed), target);
  assert.equal(rolls, 1);
  clearCocktail(state);
  state.slots = { "additive-1": "additive-serotonin" };
  const third = buildCocktail(state.slots, {}, { ...context, randomChoices: state.randomChoices });
  assert.equal(third.effectiveProfile.preferences.findIndex((entry) => entry.suppressed), target);
  assert.equal(rolls, 1);
});
