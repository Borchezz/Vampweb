import test from "node:test";
import assert from "node:assert/strict";
import { INGREDIENTS } from "../src/game/nighttime/cocktail-data.js";
import { consumeComponents, createRandomComponentInventory, getAvailableComponentUnits, hasComponentsForSlots } from "../src/game/nighttime/component-inventory.js";
import { loadBarAdditiveSlots, normalizeBarAdditiveSlots, saveBarAdditiveSlots, setBarAdditiveSlot } from "../src/game/nighttime/bar-additives.js";
import { buildCocktail, getAvailableSlot } from "../src/game/nighttime/cocktail-rules.js";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
} });
globalThis.window = new EventTarget();

test("legacy component profiles retain custom medical additives and gain the bar catalog", async (t) => {
  t.after(() => storage.clear());
  storage.set("bloodbar-nighttime-components:default", JSON.stringify([
    { id: "old-custom", name: "Авторская добавка", type: "additive", tags: [{ id: "healing", degree: 2 }] },
  ]));
  const data = await import("../src/game/nighttime/cocktail-data.js?legacy-test");
  const loaded = data.getIngredients();
  assert.equal(loaded.find((entry) => entry.id === "old-custom").additiveCategory, "medical");
  assert.equal(loaded.filter((entry) => entry.additiveCategory === "bar").length, 16);
  const customBar = { id: "custom-bar", name: "Барная", type: "additive", additiveCategory: "bar", description: "", effects: [], tags: [] };
  data.setIngredients([customBar]);
  assert.equal(data.getIngredients()[0].additiveCategory, "bar");
  assert.equal(JSON.parse(storage.get("bloodbar-nighttime-components:default"))[0].additiveCategory, "bar");
  const reloaded = await import("../src/game/nighttime/cocktail-data.js?reload-test");
  assert.deepEqual(reloaded.getIngredients(), [customBar]);
  storage.clear();
});

test("explicitly saved profiles without additives stay unchanged after reload", async (t) => {
  t.after(() => storage.clear());
  for (const [name, ingredients] of [["nonadditive", [INGREDIENTS.find((entry) => entry.id === "plasma-o")]], ["empty", []]]) {
    await t.test(name, async () => {
      storage.clear();
      const data = await import(`../src/game/nighttime/cocktail-data.js?saved-${name}`);
      data.setIngredients(ingredients);
      assert.deepEqual(JSON.parse(storage.get("bloodbar-nighttime-components:default")), ingredients);
      const reloaded = await import(`../src/game/nighttime/cocktail-data.js?saved-${name}-reload`);
      assert.deepEqual(reloaded.getIngredients(), ingredients);
    });
  }
});

test("profile copies without additives stay unchanged after reload", async (t) => {
  t.after(() => storage.clear());
  for (const operation of ["create", "overwrite"]) {
    for (const [name, ingredients] of [["nonadditive", [INGREDIENTS.find((entry) => entry.id === "plasma-o")]], ["empty", []]]) {
      await t.test(`${operation}-${name}`, async () => {
        storage.clear();
        const data = await import(`../src/game/nighttime/cocktail-data.js?copy-${operation}-${name}`);
        let target;
        if (operation === "overwrite") {
          target = data.createComponentProfile("Target");
          data.setActiveComponentProfile("default");
        }
        data.setIngredients(ingredients);
        target = operation === "create" ? data.createComponentProfile("Copy") : data.overwriteComponentProfile(target.id);
        assert.deepEqual(JSON.parse(storage.get(`bloodbar-nighttime-components:${target.id}`)), ingredients);
        assert.deepEqual(data.getIngredients(), ingredients);
        const reloaded = await import(`../src/game/nighttime/cocktail-data.js?copy-${operation}-${name}-reload`);
        assert.equal(reloaded.getActiveComponentProfileId(), target.id);
        assert.deepEqual(reloaded.getIngredients(), ingredients);
      });
    }
  }
});

test("deleting a component profile removes its version marker", async (t) => {
  t.after(() => storage.clear());
  const data = await import("../src/game/nighttime/cocktail-data.js?delete-version");
  data.setIngredients([]);
  const profile = data.createComponentProfile("Temporary");
  const storageKey = `bloodbar-nighttime-components:${profile.id}`;
  assert.equal(storage.get(`${storageKey}:version`), "4");
  data.deleteComponentProfile(profile.id);
  assert.equal(storage.has(storageKey), false);
  assert.equal(storage.has(`${storageKey}:version`), false);
  const reloaded = await import("../src/game/nighttime/cocktail-data.js?delete-version-reload");
  assert.deepEqual(reloaded.getComponentProfiles(), [{ id: "default", name: "Дефолт" }]);
  assert.deepEqual(reloaded.getIngredients(), []);
});

test("unsaved legacy migration survives repeated reloads for every storage source", async (t) => {
  t.after(() => storage.clear());
  for (const source of ["fallback", "default", "custom"]) {
    await t.test(source, async () => {
      storage.clear();
      const storageKey = source === "fallback" ? "bloodbar-nighttime-components" : `bloodbar-nighttime-components:${source}`;
      const legacy = [{ id: "old-custom", name: "Авторская добавка", type: "additive", tags: [{ id: "healing", degree: 2 }] }];
      storage.set(storageKey, JSON.stringify(legacy));
      if (source === "custom") {
        storage.set("bloodbar-nighttime-component-profiles", JSON.stringify({ profiles: [{ id: "custom", name: "Custom" }], activeProfileId: "custom" }));
      }
      for (const reload of [1, 2]) {
        const data = await import(`../src/game/nighttime/cocktail-data.js?legacy-${source}-${reload}`);
        const loaded = data.getIngredients();
        assert.deepEqual(loaded[0], { ...legacy[0], additiveCategory: "medical", description: "", effects: [] });
        assert.equal(loaded.filter((entry) => entry.additiveCategory === "bar").length, 16);
        assert.deepEqual(JSON.parse(storage.get(storageKey)), legacy);
        assert.equal(storage.has(`${storageKey}:version`), false);
      }
    });
  }
});

test("default migration uses the version marker of the selected storage source", async (t) => {
  t.after(() => storage.clear());
  const legacyKey = "bloodbar-nighttime-components";
  const profileKey = `${legacyKey}:default`;
  const plasma = [INGREDIENTS.find((entry) => entry.id === "plasma-o")];
  for (const source of ["fallback", "profile"]) {
    await t.test(source, async () => {
      storage.clear();
      const selectedKey = source === "fallback" ? legacyKey : profileKey;
      const otherKey = source === "fallback" ? profileKey : legacyKey;
      storage.set(selectedKey, JSON.stringify(plasma));
      storage.set(`${selectedKey}:version`, "3");
      storage.set(`${otherKey}:version`, "1");
      if (source === "profile") storage.set(otherKey, JSON.stringify(INGREDIENTS));
      const current = await import(`../src/game/nighttime/cocktail-data.js?source-${source}-current`);
      assert.deepEqual(current.getIngredients(), plasma);
      storage.delete(`${selectedKey}:version`);
      storage.set(`${otherKey}:version`, "2");
      const legacy = await import(`../src/game/nighttime/cocktail-data.js?source-${source}-legacy`);
      assert.equal(legacy.getIngredients().filter((entry) => entry.additiveCategory === "bar").length, 16);
    });
  }
});

test("bar additives stay unlimited while medical additives consume finite stock", () => {
  const inventory = createRandomComponentInventory(INGREDIENTS, { resourceRandomMin: 2, resourceRandomMax: 2 }, () => 0);
  const recipe = { "base-1": "plasma-o", "additive-1": "additive-olive", "additive-2": "additive-tonic" };
  assert.equal(Object.hasOwn(inventory, "additive-olive"), false);
  assert.equal(getAvailableComponentUnits(inventory, recipe, "additive-olive"), Infinity);
  assert.equal(getAvailableComponentUnits(inventory, recipe, "additive-tonic"), 1);
  assert.equal(hasComponentsForSlots(inventory, recipe), true);
  const after = consumeComponents(inventory, recipe);
  assert.equal(Object.hasOwn(after, "additive-olive"), false);
  assert.equal(after["plasma-o"], 1);
  assert.equal(after["additive-tonic"], 1);
  assert.equal(hasComponentsForSlots({}, { "additive-1": "additive-olive" }), true);
  assert.equal(hasComponentsForSlots({}, { "additive-1": "additive-tonic" }), false);
});

test("original bar additives retain their four names and single flavor tags", () => {
  const originalIds = new Set(["additive-olive", "additive-lemon", "additive-grapefruit", "additive-cherry"]);
  const bar = INGREDIENTS.filter((entry) => originalIds.has(entry.id));
  assert.deepEqual(bar.map(({ name, tags }) => ({ name, tags })), [
    { name: "Оливка", tags: [{ id: "salty", degree: 1 }] },
    { name: "Лимон", tags: [{ id: "sour", degree: 1 }] },
    { name: "Грейпфрукт", tags: [{ id: "bitter", degree: 1 }] },
    { name: "Коктейльная вишня", tags: [{ id: "sweet", degree: 1 }] },
  ]);
});

test("shelf keeps exactly four distinct bar additives and rejects medical or missing IDs", () => {
  assert.deepEqual(normalizeBarAdditiveSlots(["additive-olive", "additive-olive", "additive-tonic", "additive-lemon", "additive-cherry"]), ["additive-olive", "", "", "additive-lemon"]);
  const initial = ["additive-olive", "", "", ""];
  assert.deepEqual(setBarAdditiveSlot(initial, 1, "additive-olive"), initial);
  assert.deepEqual(setBarAdditiveSlot(initial, 1, "additive-tonic"), initial);
  assert.deepEqual(setBarAdditiveSlot(initial, 4, "additive-lemon"), initial);
  assert.deepEqual(setBarAdditiveSlot(initial, 1, "additive-lemon"), ["additive-olive", "additive-lemon", "", ""]);
  assert.deepEqual(setBarAdditiveSlot(initial, 0, ""), ["", "", "", ""]);
  assert.deepEqual(normalizeBarAdditiveSlots(["removed"]), ["", "", "", ""]);
  assert.equal(initial[0], "additive-olive", "Input state must not be mutated");
});

test("shelf storage survives reload and stays separate for component profiles", (t) => {
  t.after(() => storage.clear());
  assert.deepEqual(loadBarAdditiveSlots("profile-a"), ["", "", "", ""]);
  saveBarAdditiveSlots(["additive-olive"], "profile-a");
  saveBarAdditiveSlots(["additive-lemon"], "profile-b");
  assert.deepEqual(loadBarAdditiveSlots("profile-a"), ["additive-olive", "", "", ""]);
  assert.deepEqual(loadBarAdditiveSlots("profile-b"), ["additive-lemon", "", "", ""]);
  storage.set("bloodbar-nighttime-bar-additive-slots:broken", "{");
  assert.deepEqual(loadBarAdditiveSlots("broken"), ["", "", "", ""]);
});

test("bar additives use the same two cocktail slots without duplicates and contribute one flavor degree", () => {
  const recipe = { "base-1": "plasma-o", "additive-1": "additive-olive" };
  const olive = INGREDIENTS.find((ingredient) => ingredient.id === "additive-olive");
  const lemon = INGREDIENTS.find((ingredient) => ingredient.id === "additive-lemon");
  assert.equal(getAvailableSlot(recipe, olive), null);
  assert.equal(getAvailableSlot(recipe, lemon), null, "Only one bar additive may be in a cocktail");
  const medical = INGREDIENTS.find((ingredient) => ingredient.id === "additive-tonic");
  assert.equal(getAvailableSlot(recipe, medical).id, "additive-2");
  assert.equal(getAvailableSlot({ ...recipe, "additive-2": "additive-tonic" }, lemon), null);
  const cocktail = buildCocktail(recipe);
  assert.equal(cocktail.isComplete, true);
  assert.equal(cocktail.tags.find((tag) => tag.id === "salty").degree, 2);
});
