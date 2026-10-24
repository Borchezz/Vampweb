// Run in an isolated browser with ?mode=nighttime or ?mode=full.
// This test selects bar additives in that browser's localStorage.
export function testBarShelfEditorReachable() {
  if (document.querySelector('#editorPanel').classList.contains('open')) document.querySelector("#modeToggleButton").click();
  document.querySelector(".bar-additives-panel").scrollIntoView({ block: "end" });
  const buttons = [...document.querySelectorAll("[data-bar-clear]")];
  if (!buttons.length) throw new Error("Need a filled shelf slot for reachability test");
  for (const clear of buttons) {
    const rect = clear.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    if (hit !== clear && !clear.contains(hit)) throw new Error(`Shelf clear button is obstructed: ${clear.dataset.barClear}`);
  }
  return { passed: true, scenario: "play-mode-shelf-reachability", width: innerWidth, buttonsChecked: buttons.length };
}

export function testAdditiveCategoryEditor() {
  document.querySelector("#modeToggleButton").click();
  const selector = document.querySelector('[data-component-id="additive-olive"] [data-component-additive-category]');
  if (!selector || selector.value !== "bar") throw new Error("Editor must preserve and expose the additive category");
  selector.value = "medical";
  selector.dispatchEvent(new Event("change", { bubbles: true }));
  const updated = document.querySelector('[data-component-id="additive-olive"] [data-component-additive-category]');
  if (updated?.value !== "medical") throw new Error("Editor must save category changes");
  updated.value = "bar";
  updated.dispatchEvent(new Event("change", { bubbles: true }));
  document.querySelector("#modeToggleButton").click();
  return { passed: true, scenario: "editor-category" };
}

export async function testBarAdditivePreparation() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const { updateNighttimeSettings } = await import("../src/game/nighttime/settings.js");
  updateNighttimeSettings({ resourceLimited: true, resourceRandomMin: 2, resourceRandomMax: 2 });
  window.dispatchEvent(new Event("nighttime-components-changed"));
  const reroll = () => [...document.querySelectorAll(".ingredient-panel button")].find((button) => button.textContent === "Случайные компоненты").click();
  if (!document.querySelector('[data-bar-slot][data-ingredient-id="additive-olive"]')) {
    [...document.querySelectorAll("[data-bar-slot]")].find((button) => !button.dataset.ingredientId).click();
    document.querySelector('[data-bar-choice="additive-olive"]').click();
  }
  const shelfBefore = [...document.querySelectorAll("[data-bar-slot]")].map((button) => button.dataset.ingredientId);
  reroll();
  check(JSON.stringify(shelfBefore) === JSON.stringify([...document.querySelectorAll("[data-bar-slot]")].map((button) => button.dataset.ingredientId)), "Reroll must not change bar shelf");
  const component = (group, name) => [...document.querySelectorAll(`[data-ingredient-group="${group}"] .ingredient-button`)].find((button) => button.querySelector("strong")?.firstChild.textContent === name);
  for (let drink = 0; drink < 2; drink++) {
    component("plasma", "Плазма I (O)").click();
    component("additive", "Тоник").click();
    document.querySelector('[data-bar-slot][data-ingredient-id="additive-olive"]').click();
    check(document.querySelector(".tag-groups").textContent.includes("Солёное 2"), "Olive adds exactly one salty degree");
    const prepare = document.querySelector(".nighttime-prepare");
    check(!prepare.disabled, "Mixed bar/medical recipe must be preparable");
    prepare.click();
    check(document.querySelector(".satisfaction-panel"), "Preparing drink must produce a result");
    document.querySelector(".nighttime-prepare").closest("section").querySelector(".panel-heading button").click();
  }
  check(!component("additive", "Тоник"), "Medical stock must run out after two drinks");
  const olive = document.querySelector('[data-bar-slot][data-ingredient-id="additive-olive"]');
  check(!olive.disabled && olive.textContent.includes("∞"), "Bar stock stays unlimited after repeated preparation");
  return { passed: true, scenario: "preparation-and-reroll", drinks: 2 };
}

export async function testBarAdditiveShelf() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };

  const slots = () => [...document.querySelectorAll("[data-bar-slot]")];
  check(document.body.dataset.appReady === "true", "Application must be ready");
  check(slots().length === 4, "Bar shelf must have exactly four slots");
  check(JSON.stringify(slots().map(slot => slot.dataset.ingredientId)) === JSON.stringify(['additive-olive', 'additive-lemon', 'additive-grapefruit', 'additive-cherry']), "New shelf starts with four standard bar additives");
  document.querySelector('[data-bar-clear="0"]').click();
  document.querySelector('[data-bar-clear="1"]').click();
  check(!slots()[0].dataset.ingredientId && !slots()[1].dataset.ingredientId, "Default choices remain editable");
  check(document.querySelector(".nighttime-components-column > .ingredient-panel + .bar-additives-panel"), "Bar shelf is directly below components");
  check(document.querySelector(".ingredient-groups [data-ingredient-group=additive] h3")?.textContent === "Медицинские добавки", "Medical section must be renamed");
  slots()[0].click();
  check(document.querySelector(".bar-additive-picker"), "Clicking an empty slot opens the right-hand picker");
  const olive = document.querySelector('[data-bar-choice="additive-olive"]');
  check(olive && !olive.disabled, "Olive must be selectable");
  olive.click();
  check(slots()[0].dataset.ingredientId === "additive-olive", "Selection fills the shelf slot");
  check(slots()[0].textContent.includes("∞"), "Bar stock must display infinity");
  slots()[1].click();
  check(document.querySelector('[data-bar-choice="additive-olive"]').disabled, "Same additive cannot occupy another shelf slot");
  document.querySelector('[data-bar-choice="additive-lemon"]').click();
  slots()[0].click();
  check(document.querySelector('.cocktail-slot[data-slot-id="additive-1"]')?.textContent.includes("Оливка"), "Filled shelf slot adds to cocktail");
  check(slots()[0].disabled, "Same additive cannot be added twice to one cocktail");
  const clear = document.querySelector('[data-bar-clear="0"]');
  check(clear && !clear.hidden, "Play mode provides the shelf clear control");
  clear.click();
  check(!slots()[0].dataset.ingredientId, "Clear changes only the chosen shelf slot");
  check(slots()[1].dataset.ingredientId === "additive-lemon", "Other shelf slots stay intact");
  check(document.querySelector("[data-bar-clear]"), "Other filled slots remain clearable in play mode");
  check(!document.querySelector('#editorPanel').classList.contains('open'), "Shelf changes never enter the editor");
  return { passed: true, mode: document.body.dataset.phaseMode, savedSlot: slots()[1].dataset.ingredientId };
}
