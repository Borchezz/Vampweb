import test from "node:test";
import assert from "node:assert/strict";
import { isValidAdditiveEffect, normalizeAdditiveEffects } from "../src/game/nighttime/additive-effect-contract.js";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
} });
globalThis.window = new EventTarget();
let moduleId = 0;
const freshData = () => import(`../src/game/nighttime/cocktail-data.js?client-boost-${++moduleId}`);
const boost = (units) => ({ type: "preferred_tag_boost", units });
const key = "bloodbar-nighttime-components:default";
const oldDescription = (units) => `Один случайный тег из столбцов отношений +1 и +2 сдвигается на +${units} для текущего коктейля.`;
const oldBuiltin = (id, units, description = oldDescription(units)) => ({
  id: `additive-${id}`, name: `Авторский ${id}`, type: "additive", additiveCategory: "medical",
  description, tags: [{ id: "sweet", degree: -7 }],
  effects: [{ type: "preference_shift", attitudes: [1, 2], amount: units }],
});

for (const source of ["default", "fallback", "custom"]) {
  test(`v3 old builtin migration is in memory and preserves edits/deletions: ${source}`, async (t) => {
    storage.clear(); t.after(() => storage.clear());
    const sourceKey = source === "fallback" ? "bloodbar-nighttime-components" : `bloodbar-nighttime-components:${source}`;
    if (source === "custom") storage.set("bloodbar-nighttime-component-profiles", JSON.stringify({ profiles: [{ id: "custom", name: "Custom" }], activeProfileId: "custom" }));
    if (source === "fallback") storage.set(`${key}:version`, "4");
    const saved = [oldBuiltin("nectar", 1), oldBuiltin("ambrosia", 2, "Моё описание")];
    storage.set(sourceKey, JSON.stringify(saved)); storage.set(`${sourceKey}:version`, "3");
    for (const reload of [1, 2]) {
      const data = await freshData();
      const loaded = data.getIngredients();
      assert.equal(loaded.length, 2, `reload ${reload}: deleted entries must not return`);
      for (const [index, units] of [[0, 1], [1, 2]]) {
        assert.deepEqual(loaded[index], { ...saved[index], effects: [boost(units)],
          description: index ? saved[index].description : data.INGREDIENTS.find(({ id }) => id === saved[index].id).description });
      }
      assert.equal(storage.get(`${sourceKey}:version`), "3");
      assert.deepEqual(JSON.parse(storage.get(sourceKey)), saved);
    }
  });
}

test("v3 migration replaces only the exact old builtin effect shape", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const customEffects = [
    [], [boost(7)], [{ type: "preference_shift", attitudes: [1, 2], amount: 2 }],
    [{ type: "preference_shift", attitudes: [2, 1], amount: 1 }],
    [{ type: "preference_shift", attitudes: [1, 2], amount: 1, custom: true }],
    [...oldBuiltin("nectar", 1).effects, { type: "future", config: {} }],
    [...oldBuiltin("nectar", 1).effects, { type: "satisfaction", amount: "invalid" }],
  ];
  for (const effects of customEffects) {
    const saved = { ...oldBuiltin("nectar", 1), effects };
    storage.set(key, JSON.stringify([saved])); storage.set(`${key}:version`, "3");
    assert.deepEqual((await freshData()).getIngredients(), [{ ...saved, effects: normalizeAdditiveEffects(effects) }]);
  }
  const customId = { ...oldBuiltin("nectar", 1), id: "my-nectar" };
  storage.set(key, JSON.stringify([customId]));
  assert.deepEqual((await freshData()).getIngredients(), [customId]);
});

test("v3 empty descriptions update only alongside exact old builtin effects", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  for (const description of ["", "  ", undefined]) {
    const saved = oldBuiltin("ambrosia", 2); saved.description = description;
    storage.set(key, JSON.stringify([saved])); storage.set(`${key}:version`, "3");
    const data = await freshData();
    assert.equal(data.getIngredients()[0].description, data.INGREDIENTS.find(({ id }) => id === saved.id).description);
    assert.deepEqual(data.getIngredients()[0].effects, [boost(2)]);
  }
});

test("v3 empty catalogs and v4 deliberate edits survive; saves/create/overwrite use marker 4", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  storage.set(key, "[]"); storage.set(`${key}:version`, "3");
  assert.deepEqual((await freshData()).getIngredients(), []);
  assert.equal(storage.get(`${key}:version`), "3");
  const saved = [oldBuiltin("nectar", 1), { ...oldBuiltin("ambrosia", 2), effects: [{ type: "future", config: { units: 4 } }] }];
  const data = await freshData();
  data.setIngredients(saved);
  assert.equal(storage.get(`${key}:version`), "4");
  assert.deepEqual((await freshData()).getIngredients(), saved, "v4 old/custom effects are intentional");
  const copy = data.createComponentProfile("Copy");
  const copyKey = `bloodbar-nighttime-components:${copy.id}`;
  assert.equal(storage.get(`${copyKey}:version`), "4");
  assert.deepEqual((await freshData()).getIngredients(), saved);
  data.setActiveComponentProfile("default"); data.setIngredients([]);
  data.overwriteComponentProfile(copy.id);
  assert.equal(storage.get(`${copyKey}:version`), "4");
  assert.equal(storage.get(copyKey), "[]");
  assert.deepEqual((await freshData()).getIngredients(), []);
});

for (const version of [null, "2"]) {
  test(`older catalogs add previous content then migrate old nectar semantics: ${version}`, async (t) => {
    storage.clear(); t.after(() => storage.clear());
    const saved = [oldBuiltin("nectar", 1)];
    storage.set(key, JSON.stringify(saved));
    if (version) storage.set(`${key}:version`, version);
    const loaded = (await freshData()).getIngredients();
    assert.equal(loaded.length, 30);
    assert.deepEqual(loaded.find(({ id }) => id === "additive-nectar").effects, [boost(1)]);
    assert.deepEqual(loaded.find(({ id }) => id === "additive-ambrosia").effects, [boost(2)]);
    assert.equal(storage.get(`${key}:version`) ?? null, version);
    assert.deepEqual(JSON.parse(storage.get(key)), saved);
  });
}

test("preferred_tag_boost requires positive integer units without weakening JSON safety", () => {
  for (const units of [1, 2, 17]) assert.equal(isValidAdditiveEffect(boost(units)), true);
  for (const units of [undefined, null, 0, -1, 1.5, "1", NaN, Infinity, true]) {
    assert.equal(isValidAdditiveEffect(boost(units)), false, String(units));
  }
  assert.equal(isValidAdditiveEffect({ ...boost(1), run: () => 1 }), false);
  const cyclic = boost(1); cyclic.self = cyclic;
  assert.equal(isValidAdditiveEffect(cyclic), false);
  assert.equal(isValidAdditiveEffect(JSON.parse('{"type":"preferred_tag_boost","units":1,"__proto__":{}}')), false);
  const future = { type: "future", config: { choices: [1, "sweet"] } };
  const normalized = normalizeAdditiveEffects([boost(2), future, boost(0)]);
  assert.deepEqual(normalized, [boost(2), future]);
  future.config.choices.push(2);
  assert.deepEqual(normalized[1].config.choices, [1, "sweet"]);
});

test("default nectar and ambrosia boost existing drink tags, not client wishes", async () => {
  const { INGREDIENTS } = await freshData();
  for (const [id, units] of [["nectar", 1], ["ambrosia", 2]]) {
    const entry = INGREDIENTS.find((item) => item.id === `additive-${id}`);
    assert.deepEqual(entry.effects, [boost(units)]);
    assert.match(entry.description, /(?:напитке|коктейле)/);
    assert.match(entry.description, /\+1 и \+2/);
    assert.match(entry.description, /не выше желаемой степени/);
    assert.match(entry.description, /текущего клиента/);
    assert.doesNotMatch(entry.description, /сдвигается/);
    if (id === "ambrosia") {
      assert.match(entry.description, /два разных/);
      assert.match(entry.description, /дважды/);
    }
  }
});
