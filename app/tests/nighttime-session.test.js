import test from "node:test";
import assert from "node:assert/strict";
import * as session from "../src/game/nighttime/recipe-session.js";

test("removing one ingredient preserves all choices for the current client", () => {
  assert.equal(typeof session.removeCocktailIngredient, "function");
  const state = { slots: { "additive-1": "serotonin", "additive-2": "nectar" }, prepared: true, randomChoices: { "additive-1:serotonin:0": 0, "additive-2:nectar:0": 1 } };
  session.removeCocktailIngredient(state, "additive-1");
  assert.deepEqual(state.slots, { "additive-2": "nectar" });
  assert.deepEqual(state.randomChoices, { "additive-1:serotonin:0": 0, "additive-2:nectar:0": 1 });
  assert.equal(state.prepared, false);
});

test("clearing a recipe preserves random targets, shelf and current client", () => {
  assert.equal(typeof session.clearCocktail, "function", "recipe reset helper is not implemented yet");
  const state = { slots: { "additive-1": "additive-serotonin" }, preparation: { cold: true }, prepared: true, randomChoices: { "additive-1:additive-serotonin:0": 2 }, barSlots: ["additive-olive"], clientProfile: { id: "client" } };
  session.clearCocktail(state);
  assert.deepEqual(state.slots, {});
  assert.deepEqual(state.randomChoices, { "additive-1:additive-serotonin:0": 2 });
  assert.deepEqual(state.preparation, {});
  assert.equal(state.prepared, false);
  assert.deepEqual(state.barSlots, ["additive-olive"]);
  assert.equal(state.clientProfile.id, "client");
});
