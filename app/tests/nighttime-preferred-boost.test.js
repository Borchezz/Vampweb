import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
const { buildCocktail } = await import("../src/game/nighttime/cocktail-rules.js");
const boost = (units) => ({ id: `boost-${units}`, type: "additive", additiveCategory: "medical", tags: [], effects: [{ type: "preferred_tag_boost", units }] });
const base = (tags) => ({ id: "base", type: "plasma", tags: Object.entries(tags).map(([id, degree]) => ({ id, degree })) });
const wanted = (degrees) => ({ preferences: Object.entries(degrees).map(([tagId, degree], index) => ({ tagId, attitude: index % 2 ? 2 : 1, degree })) });
function recipe(tags, wishes, units, extraContext = {}) {
  return buildCocktail({ "base-1": "base", "additive-1": `boost-${units}` }, {}, { ingredients: [base(tags), boost(units)], profile: wanted(wishes), random: () => 0, randomChoices: {}, ...extraContext });
}
const degree = (cocktail, id) => cocktail.tags.find((tag) => tag.id === id)?.degree ?? 0;

test("ambrosia improves two distinct tags out of three eligible tags", () => {
  const result = recipe({ invigorating: 1, healing: 1, sour: 1 }, { invigorating: 2, healing: 2, sour: 2 }, 2);
  const deltas = ["invigorating", "healing", "sour"].map((id) => degree(result, id) - 1);
  assert.deepEqual(deltas.sort(), [0, 1, 1]);
});

test("ambrosia spends both units on the only eligible tag but never exceeds the desired degree", () => {
  assert.equal(degree(recipe({ invigorating: 1 }, { invigorating: 3 }, 2), "invigorating"), 3);
  assert.equal(degree(recipe({ invigorating: 2 }, { invigorating: 3 }, 2), "invigorating"), 3);
  assert.equal(degree(recipe({ invigorating: 3 }, { invigorating: 3 }, 2), "invigorating"), 3);
  assert.equal(degree(recipe({ invigorating: 4 }, { invigorating: 3 }, 2), "invigorating"), 4);
});

test("boosts never create missing or suppressed tags and do not improve unwanted or non-scaling tags", () => {
  const profile = { preferences: [{ tagId: "healing", attitude: 2, degree: 3 }, { tagId: "invigorating", attitude: -1, degree: 3 }, { tagId: "bloodO", attitude: 2 }] };
  const result = recipe({ invigorating: 1, bloodO: 1 }, {}, 2, { profile });
  assert.equal(degree(result, "healing"), 0);
  assert.equal(degree(result, "invigorating"), 1);
  assert.equal(degree(result, "bloodO"), 1);
});

test("boost priority is fixed per client even when no desired tags were initially present", () => {
  let rolls = 0;
  const context = { profile: wanted({ invigorating: 3, healing: 3, sour: 3 }), randomChoices: {}, random: () => { rolls++; return .4; } };
  recipe({}, {}, 2, context);
  const rollsAfterFirstUse = rolls;
  const first = recipe({ invigorating: 1, healing: 1, sour: 1 }, {}, 2, context);
  const second = recipe({ invigorating: 1, healing: 1, sour: 1 }, {}, 2, context);
  assert.deepEqual(first.tags, second.tags);
  assert.equal(rolls, rollsAfterFirstUse);
  const moved = buildCocktail({ "base-1": "base", "additive-2": "boost-2" }, {}, { ...context, ingredients: [base({ invigorating: 1, healing: 1, sour: 1 }), boost(2)] });
  assert.deepEqual(moved.tags, first.tags);
  assert.equal(rolls, rollsAfterFirstUse);
});

test("a boost cannot overshoot a wanted degree even after a fractional multiplier", () => {
  assert.equal(degree(recipe({ invigorating: 2.5 }, { invigorating: 3 }, 1), "invigorating"), 3);
});

test("nectar improves exactly one existing desired drink tag, not the client's wishes", () => {
  const tags = { invigorating: 1, healing: 1, sour: 1 };
  const wishes = { invigorating: 2, healing: 2, sour: 2 };
  const profile = wanted(wishes);
  const before = JSON.stringify(profile);
  const result = recipe(tags, wishes, 1, { profile });
  const deltas = Object.keys(tags).map((id) => degree(result, id) - tags[id]);
  assert.equal(deltas.reduce((sum, delta) => sum + delta, 0), 1);
  assert.equal(deltas.filter((delta) => delta === 1).length, 1);
  assert.equal(JSON.stringify(result.effectiveProfile), before);
  assert.equal(JSON.stringify(profile), before);
});
