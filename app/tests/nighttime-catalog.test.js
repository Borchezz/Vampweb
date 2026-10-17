import test from "node:test";
import assert from "node:assert/strict";
import { INGREDIENTS, formatTagLabel } from "../src/game/nighttime/cocktail-data.js";

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
} });
globalThis.window = new EventTarget();
// Daytime profile-bar imports read these DOM selectors at module initialization.
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
let moduleId = 0;
async function freshData() {
  return import(`../src/game/nighttime/cocktail-data.js?catalog-${++moduleId}`);
}

const bars = [
  ["mountain-salt", "Хлопья горной соли", "salty", "sweet"],
  ["lime", "Лайм", "sour", "salty"],
  ["ginger", "Имбирь", "bitter", "sour"],
  ["honey", "Мед", "sweet", "bitter"],
  ["celery", "Сельдерей", "salty", "sour"],
  ["pineapple", "Ананас", "sour", "bitter"],
  ["chocolate", "Шоколадная крошка", "bitter", "salty"],
  ["strawberry", "Клубника", "sweet", "sour"],
  ["pickles", "Соленья", "salty", "bitter"],
  ["passionfruit", "Маракуйа", "sour", "sweet"],
  ["rosemary", "Розмарин", "bitter", "sweet"],
  ["caramel", "Карамель", "sweet", "salty"],
];
const preference = (attitudes, amount) => ({ type: "preference_shift", attitudes, amount });
const conditional = (attitude, amount) => ({ type: "conditional_tag", attitude, tagId: "potential", amount });
const flavors = ["salty", "sweet", "sour", "bitter"];
const medical = [
  ["melatonin", "Мелатонин", [["healing", 1], ["invigorating", -1]], []],
  ["serotonin", "Серотонин", [], [preference([-2, -1], -1)]],
  ["dopamine", "Дофамин", [["invigorating", 1], ["bitter", 1]], []],
  ["noradrenaline", "Норадреналин", [["invigorating", 1], ["healing", -1], ["potential", -1]], []],
  ["adrenaline", "Адреналин", [["invigorating", 2], ["healing", -1]], [preference([1, 2], -1)]],
  ["progress", "«Прогресс»", [["invigorating", -1]], [{ type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 }]],
  ["splitter", "«Расщепитель»", [], [{ type: "blood_neutralize" }]],
  ["ambrosia", "«Амброзия»", [], [{ type: "preferred_tag_boost", units: 2 }]],
  ["desalinator", "«Опреснитель»", flavors.map((id) => [id, -1]), [{ type: "satisfaction", amount: -1 }]],
  ["cortisol", "Кортизол", [], [{ type: "desired_tag", tagIds: ["healing", "potential"], amount: 1 }]],
  ["t3", "Трийодтиронин (Т3)", [], [conditional(-2, 1)]],
  ["oxytocin", "Окситоцин", [["invigorating", -1]], [{ type: "satisfaction", amount: 1 }]],
  ["epo", "Эритропоэтин (EPO)", [["healing", 2], ["invigorating", -1]], [{ type: "ignore_blood_preferences" }, { type: "force_thick" }]],
  ["rainbow", "«Радуга»", flavors.map((id) => [id, 1]), [{ type: "satisfaction", amount: -1 }]],
  ["apotheosis", "«Апофеоз»", [["potential", 1], ["healing", 1], ["invigorating", 1]], []],
  ["mediator", "«Медиатор»", [], [preference([1], -1), preference([-1], -1)]],
  ["placebo", "«Плацебо»", [], [conditional(2, 1), conditional(-2, -1)]],
  ["nectar", "«Нектар»", [], [{ type: "preferred_tag_boost", units: 1 }]],
];
const newIds = [...bars, ...medical].map(([id]) => `additive-${id}`);

test("every builtin exposes normalized description and effects fields", () => {
  for (const entry of INGREDIENTS) {
    assert.equal(typeof entry.description, "string", entry.id);
    assert.ok(Array.isArray(entry.effects), entry.id);
  }
});

test("catalog adds exactly 12 bar and 18 medical IDs without duplicate IDs", () => {
  assert.equal(bars.length, 12);
  assert.equal(medical.length, 18);
  assert.equal(INGREDIENTS.filter(({ id }) => newIds.includes(id)).length, 30);
  assert.equal(new Set(INGREDIENTS.map(({ id }) => id)).size, INGREDIENTS.length);
});
for (const [id, name, positive, negative] of bars) {
  test(`bar catalog: ${id}`, () => {
    const entry = INGREDIENTS.find((item) => item.id === `additive-${id}`);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.name, name);
    assert.equal(entry.type, "additive");
    assert.equal(entry.additiveCategory, "bar");
    assert.deepEqual(entry.tags, [{ id: positive, degree: 1 }, { id: negative, degree: -1 }]);
    assert.deepEqual(entry.effects, []);
    assert.match(entry.description, /[А-Яа-яЁё]/);
    assert.match(entry.description, /\+1/);
    assert.match(entry.description, /−1|-1/);
  });
}
for (const [id, name, tags, effects] of medical) {
  test(`medical catalog: ${id}`, () => {
    const entry = INGREDIENTS.find((item) => item.id === `additive-${id}`);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.name, name);
    assert.equal(entry.type, "additive");
    assert.equal(entry.additiveCategory, "medical");
    assert.deepEqual(entry.tags, tags.map(([id, degree]) => ({ id, degree })));
    assert.deepEqual(entry.effects, effects);
    assert.match(entry.description, /[А-Яа-яЁё]/);
    if (id === "oxytocin") assert.match(entry.description, /[Бб]одр[^.]*[−-]1/);
  });
}

test("preference-shift descriptions distinguish one random choice from mediator's two choices", () => {
  for (const id of ["serotonin", "adrenaline"]) {
    assert.match(INGREDIENTS.find((entry) => entry.id === `additive-${id}`).description, /[Оо]дин случайный тег из столбцов/);
  }
  assert.match(INGREDIENTS.find((entry) => entry.id === "additive-mediator").description, /По одному тегу в каждом/);
});

for (const [id, description, cases] of [
  ["t3", "Если в коктейле есть тег из “Совсем не хочет”, +1 Потенциал.", [
    [[{ tagId: "sweet", attitude: -2 }], 3],
    [[{ tagId: "bitter", attitude: -2 }], 2],
  ]],
  ["placebo", "Если в напитке есть тег из “Очень хочет”, +1 Потенциал. Если есть тег из “Совсем не хочет”, −1 Потенциал.", [
    [[{ tagId: "sweet", attitude: 2 }], 3],
    [[{ tagId: "sour", attitude: -2 }], 1],
    [[{ tagId: "sweet", attitude: 2 }, { tagId: "sour", attitude: -2 }], 2],
    [[{ tagId: "bitter", attitude: 2 }], 2],
  ]],
]) {
  test(`${id} description matches any shared drink tag, not attitude to potential itself`, async () => {
    const { buildCocktail } = await import("../src/game/nighttime/cocktail-rules.js");
    const entry = INGREDIENTS.find((ingredient) => ingredient.id === `additive-${id}`);
    const base = { id: "description-base", type: "plasma", tags: [{ id: "sweet", degree: 1 }, { id: "sour", degree: 1 }, { id: "potential", degree: 2 }] };
    const slots = { "base-1": base.id, "additive-1": entry.id };
    const potentialDegree = (cocktail) => cocktail.tags.find((tag) => tag.id === "potential")?.degree ?? 0;
    for (const [preferences, expected] of cases) {
      const cocktail = buildCocktail(slots, {}, { ingredients: [base, entry], profile: { preferences } });
      assert.equal(potentialDegree(cocktail), expected, JSON.stringify(preferences));
    }
    const withoutPotential = { ...base, tags: [{ id: "sweet", degree: 1 }] };
    const absent = buildCocktail(slots, {}, { ingredients: [withoutPotential, entry], profile: { preferences: [{ tagId: "potential", attitude: -2 }] } });
    assert.equal(potentialDegree(absent), 0, "attitude to absent potential alone does not trigger the effect");
    if (id === "placebo") {
      const sharedSnapshot = buildCocktail(slots, {}, { ingredients: [withoutPotential, entry], profile: { preferences: [{ tagId: "sweet", attitude: 2 }, { tagId: "potential", attitude: -2 }] } });
      assert.equal(potentialDegree(sharedSnapshot), 1, "new potential cannot trigger the negative clause in the same snapshot");
    }
    assert.doesNotMatch(entry.description, /отношени[^.]*к (?:потенциалу|нему)/i);
    assert.equal(entry.description, description);
  });
}

test("normalization retains unbounded signed integer additive tags and deep-clones declarative effects", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const data = await freshData();
  const effects = [
    preference([-2, -1], -1),
    { type: "future_safe_effect", config: { choices: ["healing", "potential"], amount: 7 } },
  ];
  const input = [{ id: "signed", name: "Signed", type: "additive", description: "Описание <без кода>",
    tags: [-17, 0, 28, "-9", 1.5, Infinity, NaN].map((degree) => ({ id: "healing", degree })), effects }];
  const result = data.setIngredients(input);
  assert.deepEqual(result[0].tags.map(({ degree }) => degree), [-17, 0, 28, -9, 1, 1, 1]);
  assert.equal(result[0].description, input[0].description);
  assert.deepEqual(result[0].effects, effects);
  input[0].effects[0].attitudes.push(2);
  input[0].effects[1].config.choices.push("salty");
  assert.deepEqual(result[0].effects[0].attitudes, [-2, -1]);
  assert.deepEqual(result[0].effects[1].config.choices, ["healing", "potential"]);
  const reloaded = await freshData();
  assert.deepEqual(reloaded.getIngredients(), result);
  assert.equal(formatTagLabel({ id: "healing", degree: 0 }), "Целебное 0");
});

for (const type of ["plasma", "erythrocytes", "film"]) {
  test(`normalization round trip retains unbounded positive integer degrees: ${type}`, async (t) => {
    storage.clear(); t.after(() => storage.clear());
    const data = await freshData();
    const result = data.setIngredients([{ id: `unbounded-${type}`, name: type, type,
      tags: [7, 28, "9", 0, -7, 1.5, Infinity, -Infinity, NaN].map((degree) => ({ id: "healing", degree })) }]);
    assert.deepEqual(result[0].tags.map(({ degree }) => degree), [7, 28, 9, 1, 1, 1, 1, 1, 1]);
    const reloaded = await freshData();
    assert.deepEqual(reloaded.getIngredients(), result);
  });
}

for (const source of ["fallback", "default", "custom"]) {
  test(`v2 migration adds only missing new IDs in memory: ${source}`, async (t) => {
    storage.clear(); t.after(() => storage.clear());
    const key = source === "fallback" ? "bloodbar-nighttime-components" : `bloodbar-nighttime-components:${source}`;
    const customized = { id: "additive-lime", name: "Авторский лайм", type: "additive", additiveCategory: "bar", description: "Не заменять", tags: [{ id: "sour", degree: -8 }], effects: [{ type: "satisfaction", amount: 9 }] };
    const saved = [customized];
    storage.set(key, JSON.stringify(saved));
    storage.set(`${key}:version`, "2");
    if (source === "custom") storage.set("bloodbar-nighttime-component-profiles", JSON.stringify({ profiles: [{ id: "custom", name: "Custom" }], activeProfileId: "custom" }));
    if (source === "fallback") storage.set("bloodbar-nighttime-components:default:version", "3");
    for (const reload of [1, 2]) {
      const data = await freshData();
      const loaded = data.getIngredients();
      assert.equal(loaded.length, 30, `reload ${reload}`);
      assert.deepEqual(loaded.find(({ id }) => id === customized.id), customized);
      assert.deepEqual(loaded.map(({ id }) => id).sort(), [...newIds].sort());
      assert.equal(loaded.some(({ id }) => id === "additive-olive"), false, "do not restore deleted v2 bar additives");
      assert.equal(storage.get(`${key}:version`), "2", "read does not mark unsaved migration complete");
      assert.deepEqual(JSON.parse(storage.get(key)), saved);
    }
  });
}

test("v2 empty catalog receives new content once; v4 deliberate deletions and empty catalogs survive", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const key = "bloodbar-nighttime-components:default";
  storage.set(key, "[]"); storage.set(`${key}:version`, "2");
  const migrated = await freshData();
  assert.equal(migrated.getIngredients().length, 30);
  for (const saved of [[], [INGREDIENTS.find(({ id }) => id === "additive-lime")]]) {
    migrated.setIngredients(saved);
    assert.equal(storage.get(`${key}:version`), "4");
    const reloaded = await freshData();
    assert.deepEqual(reloaded.getIngredients(), saved);
  }
});

test("unmarked legacy migration keeps original four plus new thirty without writing storage", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const key = "bloodbar-nighttime-components:default";
  const legacy = [{ id: "custom", name: "Старый", type: "additive", tags: [] }];
  storage.set(key, JSON.stringify(legacy));
  for (const reload of [1, 2]) {
    const data = await freshData();
    assert.equal(data.getIngredients().length, 35, `legacy reload ${reload}`);
    assert.equal(data.getIngredients().filter(({ additiveCategory }) => additiveCategory === "bar").length, 16);
    assert.deepEqual(JSON.parse(storage.get(key)), legacy);
    assert.equal(storage.has(`${key}:version`), false);
  }
});

test("profile create and overwrite persist version 4 with deeply isolated descriptions/effects", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const data = await freshData();
  const saved = [{ ...INGREDIENTS.find(({ id }) => id === "additive-serotonin"), description: "Авторское описание" }];
  data.setIngredients(saved);
  const copy = data.createComponentProfile("Copy");
  assert.equal(storage.get(`bloodbar-nighttime-components:${copy.id}:version`), "4");
  assert.deepEqual(data.getIngredients(), saved);
  data.getIngredients()[0].effects[0].attitudes.push(2);
  data.setActiveComponentProfile("default");
  assert.deepEqual(data.getIngredients(), saved, "copy edits cannot mutate source profile");
  data.overwriteComponentProfile(copy.id);
  assert.equal(storage.get(`bloodbar-nighttime-components:${copy.id}:version`), "4");
  const reloaded = await freshData();
  assert.deepEqual(reloaded.getIngredients(), saved);
});

test("editor renders signed number inputs plus escaped editable description/effects", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const data = await import("../src/game/nighttime/cocktail-data.js");
  const editor = await import("../src/game/nighttime/component-editor.js");
  data.setIngredients([{ id: "editor-render", name: "Редактор", type: "additive", description: '</textarea><script>unsafe()</script>', tags: [{ id: "healing", degree: -12 }], effects: [preference([-2, -1], -1)] }]);
  const html = editor.renderComponentEditor();
  assert.match(html, /<input[^>]*type="number"[^>]*step="1"[^>]*value="-12"[^>]*data-component-tag-degree="healing"/);
  assert.doesNotMatch(html, /<select[^>]*data-component-tag-degree/);
  assert.doesNotMatch(html, /<input[^>]*data-component-tag-degree[^>]*(?:min|max)="/);
  assert.match(html, /data-component-description/);
  assert.match(html, /data-component-effects/);
  assert.match(html, /&lt;\/textarea>/);
  assert.doesNotMatch(html, /<script>unsafe/);
});

function editorHarness(editor) {
  const listeners = {};
  const root = { dataset: {}, addEventListener(type, fn) { listeners[type] = fn; } };
  editor.bindComponentEditorEvents(root);
  return (type, selector, properties = {}, id = "editor-events") => {
    const card = { dataset: { componentId: id } };
    const target = {
      dataset: {}, value: "", validityMessage: "", ...properties,
      closest(query) { return query === selector ? this : query === "[data-component-id]" ? card : null; },
      setCustomValidity(message) { this.validityMessage = message; },
      reportValidity() { return !this.validityMessage; },
    };
    listeners[type]({ target });
    return target;
  };
}

for (const type of ["plasma", "erythrocytes", "film"]) {
  test(`editor has no degree maximum and round trips values above three: ${type}`, async (t) => {
    storage.clear(); t.after(() => storage.clear());
    const data = await import("../src/game/nighttime/cocktail-data.js");
    const editor = await import("../src/game/nighttime/component-editor.js");
    const emit = editorHarness(editor);
    emit("change", "[data-component-profile-select]", { value: "default" });
    const id = `editor-${type}`;
    data.setIngredients([{ id, name: type, type, tags: [{ id: "healing", degree: 1 }] }]);
    const html = editor.renderComponentEditor();
    assert.match(html, /<input[^>]*data-component-tag-degree="healing"[^>]*min="1"/);
    assert.doesNotMatch(html, /<input[^>]*data-component-tag-degree[^>]*max=/);
    for (const value of ["7", "28"]) {
      const input = emit("change", "[data-component-tag-degree]", { value, dataset: { componentTagDegree: "healing" } }, id);
      assert.equal(input.validityMessage, "");
      assert.equal(data.getIngredients()[0].tags[0].degree, Number(value));
      const reloaded = await freshData();
      assert.deepEqual(reloaded.getIngredients(), data.getIngredients());
    }
    for (const value of ["1.5", "Infinity", "NaN", ""]) {
      const invalid = emit("change", "[data-component-tag-degree]", { value, dataset: { componentTagDegree: "healing" } }, id);
      assert.ok(invalid.validityMessage);
      assert.equal(data.getIngredients()[0].tags[0].degree, 28);
    }
  });
}

test("editor round trip: signed tags, description, validated JSON effects, undo/redo and CRUD", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const data = await import("../src/game/nighttime/cocktail-data.js");
  const editor = await import("../src/game/nighttime/component-editor.js");
  const emit = editorHarness(editor);
  emit("change", "[data-component-profile-select]", { value: "default" });
  data.setIngredients([{ id: "editor-events", name: "Редактор", type: "additive", tags: [{ id: "healing", degree: 1 }], effects: [] }]);
  emit("change", "[data-component-tag-degree]", { value: "-18", dataset: { componentTagDegree: "healing" } });
  assert.equal(data.getIngredients()[0].tags[0].degree, -18);
  emit("change", "[data-component-tag-degree]", { value: "0", dataset: { componentTagDegree: "healing" } });
  assert.equal(data.getIngredients()[0].tags[0].degree, 0);
  const badDegree = emit("change", "[data-component-tag-degree]", { value: "1.5", dataset: { componentTagDegree: "healing" } });
  assert.equal(data.getIngredients()[0].tags[0].degree, 0);
  assert.ok(badDegree.validityMessage);
  emit("change", "[data-component-description]", { value: "Новое описание" });
  assert.equal(data.getIngredients()[0].description, "Новое описание");
  const effects = [preference([-2, -1], -1), { type: "custom_declarative", options: { tagIds: ["healing"] } }];
  emit("change", "[data-component-effects]", { value: JSON.stringify(effects) });
  assert.deepEqual(data.getIngredients()[0].effects, effects);
  for (const value of ['[{"type":"satisfaction","amount":"oops"}]', '{"type":"force_thick"}', '(()=>window.hacked=true)()']) {
    const invalid = emit("change", "[data-component-effects]", { value });
    assert.ok(invalid.validityMessage);
    assert.deepEqual(data.getIngredients()[0].effects, effects);
  }
  emit("click", "[data-component-history-action]", { dataset: { componentHistoryAction: "undo" } });
  assert.deepEqual(data.getIngredients()[0].effects, []);
  emit("click", "[data-component-history-action]", { dataset: { componentHistoryAction: "redo" } });
  assert.deepEqual(data.getIngredients()[0].effects, effects);
  const expected = structuredClone(data.getIngredients());
  emit("click", "[data-component-delete]", { dataset: { componentDelete: "editor-events" } });
  assert.deepEqual(data.getIngredients(), []);
  emit("click", "[data-component-history-action]", { dataset: { componentHistoryAction: "undo" } });
  assert.deepEqual(data.getIngredients(), expected);
  const reloaded = await freshData();
  assert.deepEqual(reloaded.getIngredients(), expected);
  window.prompt = () => "Новая добавка";
  t.after(() => { delete window.prompt; });
  emit("click", "[data-component-create]", { dataset: { componentCreate: "additive" } });
  const created = data.getIngredients().find(({ id }) => id !== "editor-events");
  assert.equal(created.description, "");
  assert.deepEqual(created.effects, []);
  assert.equal(created.additiveCategory, "medical");
});

test("normalization defaults descriptions/effects and rejects malformed or non-data effects", async (t) => {
  storage.clear(); t.after(() => storage.clear());
  const data = await freshData();
  const result = data.setIngredients([
    { id: "defaults", name: "Defaults", type: "plasma", tags: [{ id: "salty", degree: 7 }] },
    { id: "invalid", name: "Invalid", type: "additive", description: 42, tags: [], effects: [
      null, "code()", { type: "satisfaction", amount: Infinity }, { type: "satisfaction", amount: "1" },
      { type: "preference_shift", attitudes: [99], amount: 1 },
      { type: "tag_multiply", tagId: "potential", factor: NaN, fallback: 1 },
      { type: "desired_tag", tagIds: "healing", amount: 1 },
      { type: "conditional_tag", attitude: -2, tagId: "potential", amount: 1.5 },
      { type: "future", run: () => 1 },
      JSON.parse('{"type":"future","__proto__":{"polluted":true}}'),
      { type: "satisfaction", amount: -7 },
    ] },
  ]);
  assert.equal(result[0].description, "");
  assert.deepEqual(result[0].effects, []);
  assert.equal(result[0].tags[0].degree, 7, "non-additive degrees have no upper limit");
  assert.equal(result[1].description, "");
  assert.deepEqual(result[1].effects, [{ type: "satisfaction", amount: -7 }]);
});
