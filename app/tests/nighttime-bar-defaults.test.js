import test from "node:test";
import assert from "node:assert/strict";
import { loadBarAdditiveSlots, normalizeBarAdditiveSlots, saveBarAdditiveSlots, setBarAdditiveSlot } from "../src/game/nighttime/bar-additives.js";
import { getIngredients } from "../src/game/nighttime/cocktail-data.js";

const DEFAULT_SLOTS = ["additive-olive", "additive-lemon", "additive-grapefruit", "additive-cherry"];
const STORAGE_KEY = "bloodbar-nighttime-bar-additive-slots";

function installStorage(t, entries = []) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map(entries);
  const writes = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); values.set(key, String(value)); },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  return { values, writes };
}

test("an unconfigured shelf starts with the four original bar additives without saving", (t) => {
  const { values, writes } = installStorage(t);
  assert.deepEqual(loadBarAdditiveSlots("new-profile"), DEFAULT_SLOTS);
  assert.equal(values.has(`${STORAGE_KEY}:new-profile`), false);
  assert.deepEqual(writes, []);
});

test("saved shelf choices, including deliberately empty shelves, are not replaced by defaults", (t) => {
  const { values, writes } = installStorage(t);
  for (const saved of [["", "", "", ""], [], ["", "additive-cherry"], ["additive-cherry", "additive-olive", "", "additive-lemon"], ["removed", "additive-lemon", "additive-lemon", "additive-tonic"]]) {
    const serialized = JSON.stringify(saved);
    values.set(`${STORAGE_KEY}:configured`, serialized);
    assert.deepEqual(loadBarAdditiveSlots("configured"), normalizeBarAdditiveSlots(saved));
    assert.equal(values.get(`${STORAGE_KEY}:configured`), serialized);
  }
  assert.deepEqual(writes, []);
});

test("users can change or clear defaults and each profile retains its own saved shelf", (t) => {
  const { writes } = installStorage(t);
  const changed = setBarAdditiveSlot(loadBarAdditiveSlots("a"), 0, "");
  saveBarAdditiveSlots(changed, "a");
  saveBarAdditiveSlots(["additive-cherry"], "b");
  const writesBeforeReads = writes.length;
  assert.deepEqual(loadBarAdditiveSlots("a"), ["", ...DEFAULT_SLOTS.slice(1)]);
  assert.deepEqual(loadBarAdditiveSlots("b"), ["additive-cherry", "", "", ""]);
  assert.deepEqual(loadBarAdditiveSlots("c"), DEFAULT_SLOTS);
  assert.equal(writes.length, writesBeforeReads);
});

test("unavailable shelf storage safely returns defaults", (t) => {
  installStorage(t);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
  assert.deepEqual(loadBarAdditiveSlots("denied"), DEFAULT_SLOTS);
  delete globalThis.localStorage;
  assert.deepEqual(loadBarAdditiveSlots("missing"), DEFAULT_SLOTS);
});

test("default shelves omit removed catalog IDs without restoring catalog entries", (t) => {
  const { values, writes } = installStorage(t);
  const ingredients = getIngredients();
  const original = ingredients.slice();
  t.after(() => ingredients.splice(0, ingredients.length, ...original));
  ingredients.splice(0, ingredients.length, ...original.filter(({ id }) => id !== "additive-lemon"));
  const reduced = ingredients.slice();
  assert.deepEqual(loadBarAdditiveSlots("new"), ["additive-olive", "", "additive-grapefruit", "additive-cherry"]);
  values.set(`${STORAGE_KEY}:saved`, JSON.stringify(DEFAULT_SLOTS));
  assert.deepEqual(loadBarAdditiveSlots("saved"), ["additive-olive", "", "additive-grapefruit", "additive-cherry"]);
  assert.deepEqual(ingredients, reduced);
  ingredients.splice(0, ingredients.length);
  assert.deepEqual(loadBarAdditiveSlots("empty-catalog"), ["", "", "", ""]);
  assert.equal(ingredients.length, 0);
  assert.deepEqual(writes, []);
});

test("the normalizer still returns empty slots for absent or invalid input", () => {
  for (const value of [undefined, null, {}, [], ["removed"]]) {
    assert.deepEqual(normalizeBarAdditiveSlots(value), ["", "", "", ""]);
  }
});

test("corrupt or non-array shelf storage falls back to defaults without rewriting it", (t) => {
  const { values, writes } = installStorage(t);
  for (const saved of ["{", "", "null", "{}", "false", "42", '"not-an-array"']) {
    values.set(`${STORAGE_KEY}:broken`, saved);
    assert.deepEqual(loadBarAdditiveSlots("broken"), DEFAULT_SLOTS, `stored value: ${saved}`);
    assert.equal(values.get(`${STORAGE_KEY}:broken`), saved);
  }
  assert.deepEqual(writes, []);
});
