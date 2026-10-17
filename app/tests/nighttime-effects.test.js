import test from "node:test";
import assert from "node:assert/strict";
import { buildCocktail, getAvailableSlot } from "../src/game/nighttime/cocktail-rules.js";
import { INGREDIENTS } from "../src/game/nighttime/cocktail-data.js";

const tag = (id, degree = 1) => ({ id, degree });
const component = (id, type, tags = [], effects = [], additiveCategory = "medical") => ({
  id, name: id, type, tags, effects, ...(type === "additive" ? { additiveCategory } : {}),
});
const base = (tags = []) => component("base", "plasma", tags);
const additive = (id, tags = [], effects = [], category = "medical") => component(id, "additive", tags, effects, category);
const recipe = (first, second) => ({ "base-1": "base", ...(first ? { "additive-1": first } : {}), ...(second ? { "additive-2": second } : {}) });
const findTag = (cocktail, id) => cocktail.tags.find((entry) => entry.id === id);
const active = (cocktail, id) => { const entry = findTag(cocktail, id); return Boolean(entry && entry.degree > 0 && !entry.suppressed); };

test("only one bar additive is accepted while medical combinations remain available", () => {
  const bar1 = additive("bar1", [tag("sweet")], [], "bar");
  const bar2 = additive("bar2", [tag("salty", 8)], [{ type: "satisfaction", amount: 99 }], "bar");
  const med1 = additive("med1");
  const med2 = additive("med2");
  const ingredients = [base(), bar1, bar2, med1, med2];
  const context = { ingredients };
  assert.equal(getAvailableSlot(recipe("bar1"), bar2, context), null);
  assert.equal(getAvailableSlot(recipe("bar1"), bar1, context), null);
  assert.equal(getAvailableSlot(recipe("bar1"), med1, context).id, "additive-2");
  assert.equal(getAvailableSlot(recipe("med1"), med2, context).id, "additive-2");
  assert.equal(getAvailableSlot(recipe("med1"), bar1, context).id, "additive-2");
  const invalid = buildCocktail({ "additive-2": "bar2", "base-1": "base", "additive-1": "bar1" }, {}, context);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.validationErrors, [{ code: "bar-additive-limit", slotId: "additive-2", ingredientId: "bar2" }]);
  assert.deepEqual(invalid.ingredients.map((entry) => entry.id), ["base", "bar1"]);
  assert.equal(findTag(invalid, "salty"), undefined);
  const valid = buildCocktail(recipe("bar1", "med1"), {}, context);
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.validationErrors, []);
  const duplicate = buildCocktail(recipe("med1", "med1"), {}, context);
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.validationErrors[0].code, "duplicate-additive");
});

test("preference reduction caches source indices across rebuilds and suppresses non-scaling wishes", () => {
  const shift = { type: "preference_shift", attitudes: [-2, -1], amount: -1 };
  const ingredients = [base(), additive("serotonin", [], [shift]), additive("other")];
  const profile = { id: "guest", preferences: [
    { tagId: "sweet", attitude: -2, degree: 3 },
    { tagId: "sweet", attitude: -1 },
    { tagId: "cold", attitude: -2 },
    { tagId: "healing", attitude: 1 },
  ] };
  const before = structuredClone(profile);
  let calls = 0;
  const randomChoices = {};
  const context = { ingredients, profile, randomChoices, random: () => { calls += 1; return 0.5; } };
  const first = buildCocktail(recipe("serotonin"), {}, context);
  assert.equal(calls, 1);
  assert.deepEqual(randomChoices, { "serotonin:0": 1 });
  assert.equal(first.effectiveProfile.preferences[0].degree, 3, "duplicate tagId must not select both columns");
  assert.deepEqual(first.effectiveProfile.preferences[1], { tagId: "sweet", attitude: -1, degree: 0, originalDegree: 1, suppressed: true });
  const rebuilt = buildCocktail(recipe("serotonin", "other"), { mixed: true, cold: true }, context);
  assert.deepEqual(rebuilt.effectiveProfile, first.effectiveProfile);
  assert.equal(calls, 1, "neither rendering, mixing nor other components reroll targets");
  const nonScaling = buildCocktail(recipe("serotonin"), {}, { ingredients, profile, randomChoices: {}, random: () => 0.99 });
  assert.equal(nonScaling.effectiveProfile.preferences[2].suppressed, true);
  assert.equal(nonScaling.effectiveProfile.preferences[2].originalDegree, 1);
  assert.deepEqual(profile, before);
  assert.deepEqual(buildCocktail(recipe(), {}, context).effectiveProfile.preferences, profile.preferences, "removing the component restores the baseline");
  buildCocktail(recipe("serotonin"), {}, { ...context, randomChoices: {} });
  assert.equal(calls, 2, "a new client visit receives a fresh choice cache");
  const emptyChoices = {};
  const noop = buildCocktail(recipe("serotonin"), {}, { ingredients, profile: { preferences: [] }, randomChoices: emptyChoices, random: () => { throw new Error("no candidates must not roll"); } });
  assert.deepEqual(noop.effectiveProfile.preferences, []);
  assert.deepEqual(emptyChoices, { "serotonin:0": null });
});

test("preference increases select only scaling wishes and have no degree cap", () => {
  const ingredients = [base(), additive("ambrosia", [], [{ type: "preference_shift", attitudes: [1, 2], amount: 2 }]), additive("nectar", [], [{ type: "preference_shift", attitudes: [1, 2], amount: 1 }])];
  const profile = { preferences: [
    { tagId: "cold", attitude: 2 },
    { tagId: "potential", attitude: 1, degree: 3 },
    { tagId: "sweet", attitude: -1, degree: 2 },
  ] };
  let calls = 0;
  const randomChoices = {};
  const context = { ingredients, profile, randomChoices, random: () => { calls += 1; return 0; } };
  const cocktail = buildCocktail(recipe("ambrosia", "nectar"), {}, context);
  assert.equal(cocktail.effectiveProfile.preferences[1].degree, 6);
  assert.equal(cocktail.effectiveProfile.preferences[1].originalDegree, 3);
  assert.deepEqual(cocktail.effectiveProfile.preferences[0], profile.preferences[0]);
  assert.deepEqual(cocktail.effectiveProfile.preferences[2], profile.preferences[2]);
  assert.equal(calls, 2);
  assert.deepEqual(randomChoices, { "ambrosia:0": 1, "nectar:0": 1 });
  buildCocktail(recipe("ambrosia", "nectar"), {}, context);
  assert.equal(calls, 2);
  const noCandidates = buildCocktail(recipe("ambrosia"), {}, { ingredients, profile: { preferences: [profile.preferences[0]] }, random: () => { throw new Error("only non-scaling wishes"); } });
  assert.deepEqual(noCandidates.effectiveProfile.preferences, [profile.preferences[0]]);
});

test("ignore_blood_preferences preserves and suppresses all blood wishes before target selection", () => {
  const ingredients = [base([tag("bloodA"), tag("invigorating")]),
    additive("adrenaline", [], [{ type: "preference_shift", attitudes: [1, 2], amount: -1 }]),
    additive("epo", [tag("healing", 2), tag("invigorating", -1)], [{ type: "ignore_blood_preferences" }]),
  ];
  const profile = { id: "guest", preferences: [
    { tagId: "bloodA", attitude: 2 }, { tagId: "bloodB", attitude: -2, degree: 3 },
    { tagId: "bloodO", attitude: -1 }, { tagId: "bloodAB", attitude: 1 }, { tagId: "sweet", attitude: 1, degree: 2 },
  ] };
  const before = structuredClone(profile);
  const randomChoices = {};
  const cocktail = buildCocktail(recipe("adrenaline", "epo"), {}, { ingredients, profile, randomChoices, random: () => 0 });
  assert.equal(cocktail.effectiveProfile.preferences.length, 5);
  assert.deepEqual(cocktail.effectiveProfile.preferences.slice(0, 4).map(({ degree, suppressed, originalDegree }) => ({ degree, suppressed, originalDegree })), [
    { degree: 0, suppressed: true, originalDegree: 1 }, { degree: 0, suppressed: true, originalDegree: 3 },
    { degree: 0, suppressed: true, originalDegree: 1 }, { degree: 0, suppressed: true, originalDegree: 1 },
  ]);
  assert.equal(cocktail.effectiveProfile.preferences[4].degree, 1);
  assert.equal(randomChoices["adrenaline:0"], 4);
  assert.equal(active(cocktail, "bloodA"), true, "ignoring wishes does not neutralize blood");
  assert.equal(findTag(cocktail, "healing").degree, 2);
  assert.equal(active(cocktail, "invigorating"), false);
  assert.deepEqual(profile, before);
});

test("force_thick suppresses derived liquid while retaining it for UI and restores on removal", () => {
  const ingredients = [base([tag("bloodA")]), additive("epo", [], [{ type: "force_thick" }])];
  const result = buildCocktail(recipe("epo"), {}, { ingredients });
  assert.equal(active(result, "thick"), true);
  assert.equal(findTag(result, "thick").degree, 1);
  assert.equal(findTag(result, "liquid").degree, 0);
  assert.equal(findTag(result, "liquid").suppressed, true);
  const restored = buildCocktail(recipe(), {}, { ingredients });
  assert.equal(active(restored, "liquid"), true);
  assert.equal(findTag(restored, "thick"), undefined);
  const erythrocytes = component("ery", "erythrocytes", [tag("bloodO")]);
  const alreadyThick = buildCocktail({ "base-1": "ery", "additive-1": "epo" }, {}, { ingredients: [...ingredients, erythrocytes] });
  assert.equal(findTag(alreadyThick, "thick").degree, 1);
  assert.equal(findTag(alreadyThick, "liquid"), undefined, "do not create an absent suppressed tag");
});

test("tag_multiply runs after signed contributions with an unscaled fallback for absent potential", () => {
  const multiply = additive("potentializer", [], [{ type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 }]);
  const ingredients = [base([tag("potential", 4)]), multiply, additive("minus", [tag("potential", -1)])];
  const result = buildCocktail(recipe("potentializer", "minus"), {}, { ingredients });
  assert.equal(findTag(result, "potential").degree, 6);
  const missing = buildCocktail(recipe("potentializer"), {}, { ingredients: [base(), multiply] });
  assert.equal(findTag(missing, "potential").degree, 1);
  const suppressed = buildCocktail(recipe("potentializer", "minus"), {}, { ingredients: [base([tag("potential")]), multiply, ingredients[2]] });
  assert.equal(findTag(suppressed, "potential").degree, 1);
  assert.equal(active(suppressed, "potential"), true);
  const double = buildCocktail(recipe("potentializer", "second"), {}, { ingredients: [...ingredients, additive("second", [], multiply.effects)] });
  assert.equal(findTag(double, "potential").degree, 16);
});

test("desired_tag uses effective strongest positive wishes after multipliers", () => {
  const desired = { type: "desired_tag", tagIds: ["healing", "potential"], amount: 1 };
  const ingredients = [base([tag("potential", 2)]), additive("multiplier", [], [{ type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 }]), additive("desired", [], [desired])];
  const profile = { preferences: [
    { tagId: "healing", attitude: 1 }, { tagId: "potential", attitude: 2, degree: 2 },
    { tagId: "healing", attitude: -2 },
  ] };
  const randomChoices = {};
  let calls = 0;
  const context = { ingredients, profile, randomChoices, random: () => { calls += 1; return 0; } };
  const result = buildCocktail(recipe("multiplier", "desired"), {}, context);
  assert.equal(findTag(result, "potential").degree, 5, "desired contribution is not multiplied");
  assert.equal(findTag(result, "healing"), undefined);
  assert.equal(randomChoices["desired:0"], 1);
  buildCocktail(recipe("multiplier", "desired"), { mixed: true }, context);
  assert.equal(calls, 1);
  const suppressing = additive("suppressing", [], [desired, { type: "preference_shift", attitudes: [2], amount: -2 }]);
  const suppressed = buildCocktail(recipe("suppressing"), {}, { ingredients: [...ingredients, suppressing], profile, randomChoices: {}, random: () => 0 });
  assert.equal(suppressed.effectiveProfile.preferences[1].suppressed, true);
  assert.equal(findTag(suppressed, "healing").degree, 1, "suppressed strongest wishes no longer control desired_tag");
  assert.equal(findTag(suppressed, "potential").degree, 2);
  const noPositive = buildCocktail(recipe("desired"), {}, { ingredients, profile: { preferences: [{ tagId: "healing", attitude: -2 }] }, random: () => { throw new Error("no desired tag candidate"); } });
  assert.equal(findTag(noPositive, "healing"), undefined);
  const ties = { preferences: [{ tagId: "healing", attitude: 2 }, { tagId: "potential", attitude: 2 }] };
  const tie = buildCocktail(recipe("desired"), {}, { ingredients: [base(), ingredients[2]], profile: ties, randomChoices: {}, random: () => 0.99 });
  assert.equal(findTag(tie, "potential").degree, 1);
});

test("conditional_tag checks a shared pre-conditional snapshot so opposite placebos compensate", () => {
  const plus = additive("plus", [], [{ type: "conditional_tag", attitude: 2, tagId: "potential", amount: 1 }]);
  const minus = additive("minus", [], [{ type: "conditional_tag", attitude: -2, tagId: "potential", amount: -1 }]);
  const profile = { preferences: [{ tagId: "sweet", attitude: 2 }, { tagId: "sweet", attitude: -2 }] };
  const ingredients = [base([tag("sweet")]), plus, minus];
  const result = buildCocktail(recipe("plus", "minus"), {}, { ingredients, profile });
  assert.equal(findTag(result, "potential").degree, 0);
  assert.equal(findTag(result, "potential").suppressed, true);
  const reversed = buildCocktail(recipe("minus", "plus"), {}, { ingredients, profile });
  assert.deepEqual(reversed.tags, result.tags, "negative effects may not run early and disappear on absent output tags");
  const chainProfile = { preferences: [{ tagId: "sweet", attitude: 2 }, { tagId: "potential", attitude: -2 }] };
  const chain = buildCocktail(recipe("plus", "minus"), {}, { ingredients, profile: chainProfile });
  assert.equal(findTag(chain, "potential").degree, 1, "new conditional output cannot trigger other conditionals");
  const t3 = additive("t3", [], [{ type: "conditional_tag", attitude: -2, tagId: "potential", amount: 1 }]);
  const desired = additive("desired", [], [{ type: "desired_tag", tagIds: ["healing", "potential"], amount: 1 }]);
  const fromDesired = buildCocktail(recipe("t3", "desired"), {}, { ingredients: [base(), t3, desired], profile: { preferences: [{ tagId: "potential", attitude: 2 }, { tagId: "potential", attitude: -2 }] } });
  assert.equal(findTag(fromDesired, "potential").degree, 2, "desired tags exist before the conditional snapshot");
  const derived = buildCocktail(recipe("t3"), { mixed: true, cold: true }, { ingredients: [base(), t3], profile: { preferences: [{ tagId: "liquid", attitude: -2 }] } });
  assert.equal(findTag(derived, "potential").degree, 1, "derived consistency exists before conditionals");
  const suppressed = buildCocktail(recipe("t3", "suppress"), {}, { ingredients: [...ingredients, t3, additive("suppress", [], [{ type: "preference_shift", attitudes: [-2], amount: -1 }])], profile, random: () => 0 });
  assert.equal(findTag(suppressed, "potential"), undefined, "suppressed effective preferences cannot trigger conditionals");
  const noTag = buildCocktail(recipe("t3"), {}, { ingredients: [base([tag("sweet")]), t3, additive("subtract", [tag("sweet", -1)])], profile: { preferences: [{ tagId: "healing", attitude: -2 }] } });
  assert.equal(findTag(noTag, "potential"), undefined);
});

test("blood_neutralize suppresses all blood tags and mixed derived hemolysis before conditionals", () => {
  const ingredients = [base([tag("bloodO")]), component("ery", "erythrocytes", [tag("bloodAB")]),
    component("film", "film", [tag("bloodA"), tag("bloodB"), tag("hemolysis", 3)]),
    additive("splitter", [], [{ type: "blood_neutralize" }]),
    additive("t3", [], [{ type: "conditional_tag", attitude: -2, tagId: "potential", amount: 1 }]),
  ];
  const slots = { ...recipe("splitter", "t3"), "base-2": "ery", film: "film" };
  const profile = { preferences: [{ tagId: "bloodAB", attitude: -2 }, { tagId: "hemolysis", attitude: -2 }] };
  const before = structuredClone({ ingredients, profile });
  const result = buildCocktail(slots, { mixed: true }, { ingredients, profile });
  for (const id of ["bloodO", "bloodA", "bloodB", "bloodAB", "hemolysis"]) {
    assert.equal(findTag(result, id).degree, 0, id);
    assert.equal(findTag(result, id).suppressed, true, id);
  }
  assert.equal(findTag(result, "potential"), undefined, "neutralized blood cannot trigger T3");
  assert.equal(active(result, "mixed"), true);
  const without = buildCocktail({ ...slots, "additive-1": null, "additive-2": null }, { mixed: true }, { ingredients, profile });
  assert.equal(findTag(without, "hemolysis").degree, 5, "the old hemolysis cap is removed");
  assert.equal(active(without, "bloodAB"), true);
  assert.deepEqual({ ingredients, profile }, before);
});

test("mediator makes two independent cached reductions restricted to the middle columns", () => {
  const ingredients = [base(), additive("mediator", [], [
    { type: "preference_shift", attitudes: [1], amount: -1 },
    { type: "preference_shift", attitudes: [-1], amount: -1 },
  ])];
  const profile = { preferences: [
    { tagId: "potential", attitude: 2, degree: 3 }, { tagId: "healing", attitude: 1, degree: 2 },
    { tagId: "cold", attitude: 1 }, { tagId: "sweet", attitude: -1 },
    { tagId: "sour", attitude: -1, degree: 2 }, { tagId: "bitter", attitude: -2 },
  ] };
  const rolls = [0.99, 0];
  const randomChoices = {};
  let calls = 0;
  const context = { ingredients, profile, randomChoices, random: () => rolls[calls++] };
  const result = buildCocktail(recipe("mediator"), {}, context);
  assert.deepEqual(randomChoices, { "mediator:0": 2, "mediator:1": 3 });
  assert.equal(result.effectiveProfile.preferences[2].suppressed, true);
  assert.equal(result.effectiveProfile.preferences[3].suppressed, true);
  for (const index of [0, 1, 4, 5]) assert.deepEqual(result.effectiveProfile.preferences[index], profile.preferences[index]);
  buildCocktail(recipe("mediator"), {}, context);
  assert.equal(calls, 2);
});

test("conditional snapshot excludes suppressed drink tags and includes multiplier fallback", () => {
  const t3 = additive("t3", [], [{ type: "conditional_tag", attitude: -2, tagId: "potential", amount: 1 }]);
  const minus = additive("minus", [tag("sweet", -1)]);
  const context = { ingredients: [base([tag("sweet")]), t3, minus], profile: { preferences: [{ tagId: "sweet", attitude: -2 }] } };
  const result = buildCocktail(recipe("t3", "minus"), {}, context);
  assert.equal(findTag(result, "sweet").suppressed, true);
  assert.equal(findTag(result, "potential"), undefined);
  const multiplier = additive("multiplier", [], [{ type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 }]);
  const fromFallback = buildCocktail(recipe("t3", "multiplier"), {}, { ingredients: [base(), t3, multiplier], profile: { preferences: [{ tagId: "potential", attitude: -2 }] } });
  assert.equal(findTag(fromFallback, "potential").degree, 2);
});

test("invalid second bar additive cannot execute random or tag effects", () => {
  const ingredients = [base([tag("potential")]), additive("bar", [], [], "bar"), additive("forbidden", [], [
    { type: "preference_shift", attitudes: [-2], amount: -1 },
    { type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 },
  ], "bar")];
  const profile = { preferences: [{ tagId: "sweet", attitude: -2 }] };
  const randomChoices = {};
  const result = buildCocktail(recipe("bar", "forbidden"), {}, { ingredients, profile, randomChoices, random: () => { throw new Error("invalid ingredient cannot execute"); } });
  assert.equal(result.valid, false);
  assert.equal(findTag(result, "potential").degree, 1);
  assert.deepEqual(result.effectiveProfile, profile);
  assert.deepEqual(randomChoices, {});
});

test("real catalog IDs execute EPO, progress, T3, placebo and signed bar contributions", () => {
  const profile = { id: "guest", preferences: [
    { tagId: "bloodA", attitude: 2 }, { tagId: "potential", attitude: -2 },
    { tagId: "potential", attitude: 2 },
  ] };
  const before = structuredClone({ ingredients: INGREDIENTS, profile });
  const context = { ingredients: INGREDIENTS, profile, randomChoices: {}, random: () => 0 };
  const epo = buildCocktail({ "base-1": "plasma-a", film: "film-salty-invigorating", "additive-1": "additive-epo" }, {}, context);
  assert.equal(epo.valid, true);
  assert.equal(active(epo, "thick"), true);
  assert.equal(findTag(epo, "liquid").suppressed, true);
  assert.equal(findTag(epo, "invigorating").suppressed, true);
  assert.equal(findTag(epo, "healing").degree, 2);
  assert.equal(epo.effectiveProfile.preferences[0].suppressed, true);
  const progress = buildCocktail({ "base-1": "erythrocytes-ab", "additive-1": "additive-progress", "additive-2": "additive-t3" }, {}, context);
  assert.equal(findTag(progress, "potential").degree, 3, "multiplied 1*2 then T3 +1");
  const placebo = buildCocktail({ "base-1": "erythrocytes-ab", "additive-1": "additive-placebo" }, {}, context);
  assert.equal(findTag(placebo, "potential").degree, 1, "both placebo clauses evaluate independently");
  const salt = buildCocktail({ "base-1": "plasma-a", "additive-1": "additive-mountain-salt" }, {}, context);
  assert.equal(findTag(salt, "sweet").suppressed, true);
  assert.equal(findTag(salt, "salty").degree, 1);
  assert.deepEqual({ ingredients: INGREDIENTS, profile }, before);
});

test("satisfaction effects accumulate separately from signed tag changes without mutating inputs", () => {
  const ingredients = [
    base([tag("salty", 2), tag("sweet"), tag("sour"), tag("invigorating")]),
    additive("desalt", [tag("salty", -1), tag("sweet", -1), tag("sour", -1), tag("bitter", -1)], [{ type: "satisfaction", amount: -1 }]),
    additive("oxytocin", [tag("invigorating", -1)], [{ type: "satisfaction", amount: 1 }]),
  ];
  const profile = { id: "guest", preferences: [{ tagId: "sweet", attitude: 2, degree: 3 }] };
  const baseline = structuredClone({ ingredients, profile });
  const result = buildCocktail(recipe("desalt", "oxytocin"), {}, { ingredients, profile });
  assert.equal(result.satisfactionModifier, 0);
  assert.equal(findTag(result, "salty").degree, 1);
  assert.equal(active(result, "sweet"), false);
  assert.equal(active(result, "sour"), false);
  assert.equal(active(result, "invigorating"), false);
  assert.equal(findTag(result, "bitter"), undefined);
  assert.notEqual(result.effectiveProfile, profile);
  assert.notEqual(result.effectiveProfile.preferences[0], profile.preferences[0]);
  assert.deepEqual({ ingredients, profile }, baseline);
  assert.equal(buildCocktail(recipe("desalt"), {}, { ingredients }).satisfactionModifier, -1);
  assert.equal(buildCocktail(recipe("oxytocin"), {}, { ingredients }).satisfactionModifier, 1);
  assert.equal(buildCocktail(recipe(), {}, { ingredients }).effectiveProfile, null);
  const bar = additive("bar", [], [], "bar");
  const forbidden = additive("forbidden", [], [{ type: "satisfaction", amount: 99 }], "bar");
  assert.equal(buildCocktail(recipe("bar", "forbidden"), {}, { ingredients: [base(), bar, forbidden] }).satisfactionModifier, 0);
});

test("injected catalog sums unbounded degrees before applying signed contributions", () => {
  const ingredients = [
    base([tag("potential", 4), tag("bloodO"), tag("salty")]),
    additive("minus", [tag("potential", -2), tag("salty", -2), tag("healing", -1)]),
    additive("plus", [tag("potential", 3), tag("bloodO", 3)]),
  ];
  const before = structuredClone(ingredients);
  const cocktail = buildCocktail(recipe("minus", "plus"), {}, { ingredients });
  assert.equal(cocktail.isComplete, true);
  assert.equal(findTag(cocktail, "potential").degree, 5);
  assert.equal(findTag(cocktail, "bloodO").degree, 1, "non-scaling tags express presence");
  assert.deepEqual({ degree: findTag(cocktail, "salty").degree, suppressed: findTag(cocktail, "salty").suppressed }, { degree: 0, suppressed: true });
  assert.equal(findTag(cocktail, "healing"), undefined, "negative-only tags are never created");
  const reversed = { "base-1": "base", "additive-2": "plus", "additive-1": "minus" };
  assert.deepEqual(buildCocktail(reversed, {}, { ingredients }).tags, cocktail.tags);
  assert.equal(findTag(buildCocktail(recipe("plus"), {}, { ingredients }), "salty").degree, 1);
  assert.deepEqual(ingredients, before);
});
