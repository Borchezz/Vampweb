import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
const rules = await import("../src/game/nighttime/cocktail-rules.js");

test("hint compatibility rows match all sixteen actual plasma/erythrocyte recipes", () => {
  assert.equal(typeof rules.getBloodCompatibilityRows, "function", "Expose the actual gameplay compatibility matrix for hints");
  const rows = rules.getBloodCompatibilityRows();
  const suffix = { bloodO: "o", bloodA: "a", bloodB: "b", bloodAB: "ab" };
  assert.deepEqual(rows.map((row) => row.plasmaTagId), Object.keys(suffix));
  assert.deepEqual(rows.map((row) => row.erythrocytes.map((cell) => cell.compatible)), [
    [true, false, false, false], [true, true, false, false],
    [true, false, true, false], [true, true, true, true],
  ]);
  for (const row of rows) {
    assert.deepEqual(row.erythrocytes.map((cell) => cell.tagId), Object.keys(suffix));
    for (const cell of row.erythrocytes) {
      const drink = rules.buildCocktail({ "base-1": `plasma-${suffix[row.plasmaTagId]}`, "base-2": `erythrocytes-${suffix[cell.tagId]}` });
      assert.equal(!drink.tags.some((tag) => tag.id === "hemolysis" && tag.degree > 0), cell.compatible);
    }
  }
  rows[0].erythrocytes[0].compatible = false;
  assert.equal(rules.getBloodCompatibilityRows()[0].erythrocytes[0].compatible, true, "Hints must not mutate gameplay rules");
});

const examples = [
  ["thick", { "base-1": "erythrocytes-o" }, {}],
  ["liquid", { "base-1": "plasma-o" }, {}],
  ["layered", { "base-1": "plasma-o", film: "film-sour-healing" }, {}],
  ["mixed", { "base-1": "plasma-o", "additive-1": "additive-tonic" }, { mixed: true }],
  ["cold", { "base-1": "plasma-o" }, { cold: true }],
  ["warm", { "base-1": "plasma-o" }, { warm: true }],
];
for (const [tagId, slots, preparation] of examples) {
  test(`documented hint example produces ${tagId}`, () => {
    const cocktail = rules.buildCocktail(slots, preparation);
    assert.ok(cocktail.tags.some((tag) => tag.id === tagId && !tag.suppressed));
  });
}
test("equal base counts produce neither consistency tag, while EPO overrides the base rule", () => {
  const slots = { "base-1": "plasma-o", "base-2": "erythrocytes-o" };
  assert.ok(!rules.buildCocktail(slots).tags.some((tag) => ["thick", "liquid"].includes(tag.id)));
  const overridden = rules.buildCocktail({ ...slots, "additive-1": "additive-epo" });
  assert.ok(overridden.tags.some((tag) => tag.id === "thick" && !tag.suppressed));
});
