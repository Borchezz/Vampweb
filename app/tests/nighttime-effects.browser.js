// Execute only in an isolated browser profile; integration scenarios alter its test data.
export async function testDrinkBoostExamples() {
  const { getIngredients, setIngredients } = await import("../src/game/nighttime/cocktail-data.js");
  const { setClients } = await import("../src/game/nighttime/client-preferences.js");
  const { updateNighttimeSettings } = await import("../src/game/nighttime/settings.js");
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  updateNighttimeSettings({ resourceLimited: false });
  const source = getIngredients().filter((entry) => entry.id !== "browser-boost-base");
  const cases = [
    { base: { invigorating: 1, healing: 1, sour: 1 }, desired: 2, ingredient: "additive-ambrosia", expected: [1, 2, 2] },
    { base: { invigorating: 1 }, desired: 3, ingredient: "additive-ambrosia", expected: [3] },
    { base: { invigorating: 2 }, desired: 3, ingredient: "additive-ambrosia", expected: [3] },
    { base: { invigorating: 1, healing: 1, sour: 1 }, desired: 2, ingredient: "additive-nectar", expected: [1, 1, 2] },
  ];
  for (const [index, scenario] of cases.entries()) {
    const ids = Object.keys(scenario.base);
    setIngredients([...source, { id: "browser-boost-base", name: "Контрольная основа", type: "plasma", tags: Object.entries(scenario.base).map(([id, degree]) => ({ id, degree })) }]);
    setClients([{ id: `boost-client-${index}`, name: "Контрольный клиент", preferences: ids.map((tagId, n) => ({ tagId, attitude: n % 2 ? 1 : 2, degree: scenario.desired })) }]);
    [...document.querySelectorAll(".client-panel button")].find((button) => button.textContent === "Постоянный клиент").click();
    document.querySelector('.ingredient-panel [data-ingredient-id="browser-boost-base"]').click();
    document.querySelector(`.ingredient-panel [data-ingredient-id="${scenario.ingredient}"]`).click();
    const values = ids.map((id) => Number(document.querySelector(`.tag-groups [data-tag-id="${id}"]`).textContent.match(/([\d.]+)$/)[1]));
    check(JSON.stringify(values.sort((a, b) => a - b)) === JSON.stringify(scenario.expected), `Wrong drink boost in scenario ${index}`);
    const wishes = [...document.querySelectorAll(".client-panel [data-tag-id]")].map((chip) => Number(chip.textContent.match(/(\d+)/)?.[1]));
    check(wishes.every((degree) => degree === scenario.desired), "Boost must not change client wishes");
    const before = document.querySelector(".tag-groups").textContent;
    document.querySelector('.cocktail-slot[data-slot-id="additive-1"] button').click();
    document.querySelector(`.ingredient-panel [data-ingredient-id="${scenario.ingredient}"]`).click();
    check(document.querySelector(".tag-groups").textContent === before, "Remove/readd must preserve the same boost selection");
  }
  return { passed: true, scenario: "drink-boost-examples", examples: cases.length };
}
export function testMedicalListLayout() {
  const group = document.querySelector('[data-ingredient-group="additive"]');
  if (group.getBoundingClientRect().height > Math.min(560, innerHeight * .65) + 1) throw new Error("Medical list must scroll instead of pushing bar shelf thousands of pixels down");
  if (group.scrollHeight <= group.clientHeight) throw new Error("Expanded medical catalog must remain scrollable");
  return { passed: true, scenario: "medical-list-layout" };
}

export async function testLivePreferenceEffects() {
  const { setClients, getClients } = await import("../src/game/nighttime/client-preferences.js");
  const { updateNighttimeSettings } = await import("../src/game/nighttime/settings.js");
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  updateNighttimeSettings({ resourceLimited: false });
  window.dispatchEvent(new Event("nighttime-components-changed"));
  const profile = { id: "effects-browser-client", name: "Клиент для проверки", preferences: [{ tagId: "sour", attitude: -1, degree: 1 }, { tagId: "bitter", attitude: -2, degree: 1 }, { tagId: "potential", attitude: 2, degree: 2 }] };
  setClients([profile]);
  const before = JSON.stringify(getClients());
  [...document.querySelectorAll(".client-panel button")].find((button) => button.textContent === "Постоянный клиент").click();
  const component = (id) => document.querySelector(`.ingredient-panel [data-ingredient-id="${id}"]`);
  component("plasma-o").click();
  const originalRandom = Math.random;
  let rolls = 0;
  Math.random = () => { rolls++; return 0; };
  try {
    check(component("additive-serotonin"), "Serotonin must be present in the medical catalog");
    component("additive-serotonin").click();
    check(rolls === 1, "Random target chosen once on ingredient addition");
    const changed = document.querySelectorAll(".client-panel .tag-suppressed");
    check(changed.length === 1, "One disliked wish must be suppressed at degree one");
    const selectedIndex = changed[0].dataset.preferenceIndex;
    [...document.querySelectorAll(".nighttime-preparation-controls button")].find((button) => button.textContent === "Перемешать").click();
    check(rolls === 1, "Rerender must not reroll an effect target");
    check(document.querySelector(".client-panel .tag-suppressed").dataset.preferenceIndex === selectedIndex, "Target remains stable");
    window.dispatchEvent(new Event("nighttime-components-changed"));
    check(document.querySelector(".client-panel .tag-suppressed")?.dataset.preferenceIndex === selectedIndex, "Unchanged catalog rerender must preserve recipe and effect target");
    check(rolls === 1, "Unchanged catalog must not reroll targets");
    check(JSON.stringify(getClients()) === before, "Saved client profile must remain unchanged");
    document.querySelector('.cocktail-slot[data-slot-id="additive-1"] button').click();
    check(!document.querySelector(".client-panel .tag-suppressed"), "Removing ingredient restores the original wishes");
    component("additive-serotonin").click();
    check(rolls === 1, "Re-adding ingredient must not reroll for the current client");
    check(document.querySelector(".client-panel .tag-suppressed").dataset.preferenceIndex === selectedIndex, "Re-adding preserves the same target");
    document.querySelector('.cocktail-slot[data-slot-id="additive-1"] button').click();
    component("additive-tonic").click();
    component("additive-serotonin").click();
    check(rolls === 1, "Moving ingredient to the second slot must not reroll");
    check(document.querySelector(".client-panel .tag-suppressed").dataset.preferenceIndex === selectedIndex, "Slot change preserves the target");
    document.querySelector(".nighttime-prepare").closest("section").querySelector(".panel-heading button").click();
    component("plasma-o").click();
    component("additive-serotonin").click();
    check(rolls === 1, "Clearing the cocktail must not reroll for the same client");
    setClients([...getClients(), { ...profile, id: "effects-browser-client-next", name: "Следующий клиент" }]);
    [...document.querySelectorAll(".client-panel button")].find((button) => button.textContent === "Постоянный клиент").click();
    const beforeNewClientEffect = rolls;
    component("additive-serotonin").click();
    check(rolls === beforeNewClientEffect + 1, "A new client visit permits a fresh random choice");
  } finally { Math.random = originalRandom; }
  document.querySelector(".nighttime-prepare").closest("section").querySelector(".panel-heading button").click();
  component("plasma-o").click();
  component("erythrocytes-ab").click();
  component("additive-splitter").click();
  const blood = [...document.querySelectorAll(".tag-groups [data-tag-id]")].filter((chip) => chip.dataset.tagId.startsWith("blood"));
  check(blood.length > 0 && blood.every((chip) => chip.classList.contains("tag-suppressed")), "Splitter shades blood groups");
  check(!document.querySelector('.tag-groups [data-tag-id="hemolysis"]:not(.tag-suppressed)'), "Splitter prevents active hemolysis");
  return { passed: true, scenario: "live-preference-effects", randomRolls: rolls };
}

export async function testSingleBarLimit() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const slots = () => [...document.querySelectorAll("[data-bar-slot]")];
  for (const [index, id] of [[0, "additive-olive"], [1, "additive-lemon"]]) {
    if (!slots()[index].dataset.ingredientId) { slots()[index].click(); document.querySelector(`[data-bar-choice="${id}"]`).click(); }
  }
  document.querySelector(".nighttime-prepare").closest("section").querySelector(".panel-heading button").click();
  slots()[0].click();
  check(slots()[1].disabled, "Second bar additive must be blocked even with a free cocktail slot");
  document.querySelector('.cocktail-slot[data-slot-id="additive-1"] button').click();
  check(!slots()[1].disabled, "Removing bar additive frees the one-bar limit");
  return { passed: true, scenario: "one-bar-additive" };
}

export async function testSuppressedTagPresentation() {
  const { createClientPanel, createTagPanel } = await import("../src/game/nighttime/runtime.js");
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const profile = { name: "Тест", preferences: [{ tagId: "bloodAB", attitude: -2 }, { tagId: "healing", attitude: 1, degree: 2 }] };
  const cocktail = { tags: [{ id: "healing", label: "Целебное", category: "benefit", degree: 0, suppressed: true }], effectiveProfile: { ...profile, preferences: [{ ...profile.preferences[0], suppressed: true }, { ...profile.preferences[1], degree: 0, originalDegree: 2, suppressed: true }] } };
  const clientPanel = createClientPanel(cocktail, profile, () => {}, () => {});
  const tagPanel = createTagPanel(cocktail);
  check(clientPanel.querySelectorAll(".tag-suppressed").length === 2, "Suppressed wishes must stay visible and shaded");
  check(tagPanel.querySelector(".tag-suppressed[data-tag-id=healing]")?.textContent.includes("0"), "Suppressed drink tag must stay visible at zero");
  check(!clientPanel.querySelector(".preference-progress"), "Suppressed wishes have no satisfaction marker");
  return { passed: true, scenario: "suppressed-presentation" };
}
