import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
const { INGREDIENTS } = await import("../src/game/nighttime/cocktail-data.js");
const { buildCocktail } = await import("../src/game/nighttime/cocktail-rules.js");

const profile = { id: "integration", preferences: [
  { tagId: "salty", attitude: -2, degree: 1 },
  { tagId: "sour", attitude: -1, degree: 2 },
  { tagId: "healing", attitude: 1, degree: 2 },
  { tagId: "potential", attitude: 2, degree: 2 },
  { tagId: "bloodO", attitude: 2 },
] };
const degree = (cocktail, id) => cocktail.tags.find((tag) => tag.id === id)?.degree ?? 0;
const wish = (cocktail, id) => cocktail.effectiveProfile.preferences.find((entry) => entry.tagId === id);
function drink(additive, base = ["plasma-o"]) {
  const slots = Object.fromEntries(base.map((id, index) => [`base-${index + 1}`, id]));
  slots["additive-1"] = `additive-${additive}`;
  const result = buildCocktail(slots, {}, { profile, random: () => 0, randomChoices: {} });
  assert.equal(result.valid, true);
  assert.ok(result.ingredients.some((entry) => entry.id === `additive-${additive}`));
  return result;
}

const barCases = [
  ["mountain-salt", "salty", "sweet"], ["lime", "sour", "salty"], ["ginger", "bitter", "sour"],
  ["honey", "sweet", "bitter"], ["celery", "salty", "sour"], ["pineapple", "sour", "bitter"],
  ["chocolate", "bitter", "salty"], ["strawberry", "sweet", "sour"], ["pickles", "salty", "bitter"],
  ["passionfruit", "sour", "sweet"], ["rosemary", "bitter", "sweet"], ["caramel", "sweet", "salty"],
];
for (const [id, increase, decrease] of barCases) test(`real bar effect: ${id}`, () => {
  const allFlavors = { id: "integration-base", type: "plasma", tags: ["salty", "sour", "sweet", "bitter"].map((tagId) => ({ id: tagId, degree: 1 })) };
  const cocktail = buildCocktail({ "base-1": allFlavors.id, "additive-1": `additive-${id}` }, {}, { ingredients: [...INGREDIENTS, allFlavors] });
  assert.equal(degree(cocktail, increase), 2);
  assert.equal(degree(cocktail, decrease), 0);
  assert.equal(cocktail.tags.find((tag) => tag.id === decrease).suppressed, true);
});

const medicalCases = [
  ["melatonin", ["erythrocytes-a"], (c) => { assert.equal(degree(c, "healing"), 1); assert.equal(degree(c, "invigorating"), 0); }],
  ["serotonin", ["plasma-o"], (c) => { assert.equal(wish(c, "salty").suppressed, true); assert.equal(wish(c, "sour").degree, 2); }],
  ["dopamine", ["plasma-o"], (c) => { assert.equal(degree(c, "invigorating"), 1); assert.equal(degree(c, "bitter"), 1); }],
  ["noradrenaline", ["erythrocytes-b", "erythrocytes-ab"], (c) => { assert.equal(degree(c, "invigorating"), 1); assert.equal(degree(c, "healing"), 0); assert.equal(degree(c, "potential"), 0); }],
  ["adrenaline", ["erythrocytes-b"], (c) => { assert.equal(degree(c, "invigorating"), 2); assert.equal(degree(c, "healing"), 0); assert.equal(wish(c, "healing").degree, 1); }],
  ["progress", ["erythrocytes-ab"], (c) => { assert.equal(degree(c, "potential"), 2); assert.equal(degree(drink("progress"), "potential"), 1); }],
  ["splitter", ["plasma-o", "erythrocytes-ab"], (c) => { assert.equal(degree(c, "bloodO"), 0); assert.equal(degree(c, "bloodAB"), 0); assert.equal(degree(c, "hemolysis"), 0); }],
  ["ambrosia", ["erythrocytes-b", "erythrocytes-ab"], (c) => { assert.equal(degree(c, "healing"), 2); assert.equal(degree(c, "potential"), 2); assert.equal(wish(c, "healing").degree, 2); assert.equal(wish(c, "potential").degree, 2); }],
  ["desalinator", ["plasma-o", "plasma-b"], (c) => { assert.equal(degree(c, "salty"), 0); assert.equal(degree(c, "sour"), 0); assert.equal(c.satisfactionModifier, -1); }],
  ["cortisol", ["plasma-o"], (c) => { assert.equal(degree(c, "potential"), 1); assert.equal(degree(c, "healing"), 0); }],
  ["t3", ["plasma-o"], (c) => { assert.equal(degree(c, "potential"), 1); }],
  ["oxytocin", ["erythrocytes-a"], (c) => { assert.equal(degree(c, "invigorating"), 0); assert.equal(c.satisfactionModifier, 1); }],
  ["epo", ["plasma-o"], (c) => { assert.equal(degree(c, "healing"), 2); assert.equal(degree(c, "thick"), 1); assert.equal(degree(c, "liquid"), 0); assert.equal(wish(c, "bloodO").suppressed, true); assert.equal(degree(c, "bloodO"), 1); }],
  ["rainbow", ["plasma-o"], (c) => { assert.equal(degree(c, "salty"), 2); for (const id of ["sour", "sweet", "bitter"]) assert.equal(degree(c, id), 1); assert.equal(c.satisfactionModifier, -1); }],
  ["apotheosis", ["plasma-o"], (c) => { for (const id of ["potential", "healing", "invigorating"]) assert.equal(degree(c, id), 1); }],
  ["mediator", ["plasma-o"], (c) => { assert.equal(wish(c, "healing").degree, 1); assert.equal(wish(c, "sour").degree, 1); assert.equal(wish(c, "salty").degree, 1); }],
  ["placebo", ["plasma-o", "erythrocytes-ab"], (c) => { assert.equal(degree(c, "potential"), 1); }],
  ["nectar", ["erythrocytes-b"], (c) => { assert.equal(degree(c, "healing"), 2); assert.equal(wish(c, "healing").degree, 2); }],
];
for (const [id, base, verify] of medicalCases) test(`real medical effect: ${id}`, () => {
  const before = JSON.stringify(profile);
  verify(drink(id, base));
  assert.equal(JSON.stringify(profile), before, "Saved wishes must never be mutated");
});
assert.equal(barCases.length, 12);
assert.equal(medicalCases.length, 18);
