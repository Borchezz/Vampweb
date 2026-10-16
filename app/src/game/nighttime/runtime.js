import { COCKTAIL_SLOT_CONFIG, LINKED_FILM_IDS, TAG_CATEGORY, TAG_DEFINITIONS, formatTagLabel, getActiveComponentProfileId, getIngredientById, getIngredients } from "./cocktail-data.js";
import { createRandomPreferenceProfile, deleteClient, getRandomStoredClient, PREFERENCE_ATTITUDE, PREFERENCE_ATTITUDE_LABEL } from "./client-preferences.js";
import { bindClientEditor, renderClientEditor } from "./client-editor.js";
import { evaluateClientSatisfaction } from "./client-satisfaction.js";
import { buildCocktail, getAvailableSlot } from "./cocktail-rules.js";
import { consumeComponents, createRandomComponentInventory, getAvailableComponentUnits, hasComponentsForSlots, isBarAdditive } from "./component-inventory.js";
import { loadBarAdditiveSlots, normalizeBarAdditiveSlots, saveBarAdditiveSlots, setBarAdditiveSlot } from "./bar-additives.js";
import { getNighttimeSettings, updateNighttimeSettings } from "./settings.js";
import { bindComponentEditorEvents, renderComponentEditor, renderComponentEditorProfileBar } from "./component-editor.js";
import { registerDebugPanelController } from "../debug-panel.js";

const groupLabels = { plasma: "Плазма", erythrocytes: "Эритроциты", film: "Плёнка", additive: "Медицинские добавки" };
const categoryLabels = {
  [TAG_CATEGORY.flavor]: "Вкус",
  [TAG_CATEGORY.bloodGroup]: "Группа крови",
  [TAG_CATEGORY.benefit]: "Польза",
  [TAG_CATEGORY.composition]: "Состав",
  [TAG_CATEGORY.serving]: "Подача",
};
const filmFlavorIds = ["bitter", "sour", "sweet", "salty"];
const filmBenefitIds = ["invigorating", "healing", "potential", "neutral"];

function node(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function ingredientTagList(entry) {
  const tags = node("div", "ingredient-tag-list");
  entry.tags.forEach((tag) => {
    const definition = TAG_DEFINITIONS[tag.id];
    tags.append(node("span", "cocktail-tag tag-" + definition.category, formatTagLabel({ ...tag, ...definition })));
  });
  return tags;
}

function getIngredientUnits(state, ingredientId) {
  if (!getNighttimeSettings().resourceLimited) return Infinity;
  return getAvailableComponentUnits(state.inventory, state.slots, ingredientId);
}

function rollComponents(state) {
  state.inventory = createRandomComponentInventory(getIngredients(), getNighttimeSettings());
  state.slots = {};
  state.preparation = {};
  state.prepared = false;
}

function registerNighttimeDebugCheats(state, root) {
  registerDebugPanelController({
    id: "nighttime",
    label: "Ночь",
    render: () => `
      <div class="debug-panel-heading"><strong>Ночная тестовая сессия</strong><button class="icon-button" type="button" data-debug-close aria-label="Закрыть чит-панель">×</button></div>
      <section class="debug-cheat-section">
        <h3>Коктейль</h3>
        <div class="debug-cheat-row">
          <button class="secondary-button compact-button" type="button" data-debug-controller="nighttime" data-debug-action="clear-cocktail">Очистить слоты</button>
          <button class="secondary-button compact-button" type="button" data-debug-controller="nighttime" data-debug-action="reroll-components">Случайные компоненты</button>
        </div>
      </section>
      <section class="debug-cheat-section">
        <h3>Следующий посетитель</h3>
        <div class="debug-cheat-row">
          <button class="secondary-button compact-button" type="button" data-debug-controller="nighttime" data-debug-action="random-client">Случайный клиент</button>
        </div>
      </section>
      <p class="debug-panel-note">Ночные читы меняют только текущую сессию и не сохраняются в профиль.</p>
    `,
    handleAction: (action) => {
      if (action.dataset.debugAction === "clear-cocktail") {
        state.slots = {};
        state.preparation = {};
        state.prepared = false;
      } else if (action.dataset.debugAction === "reroll-components") {
        rollComponents(state);
      } else if (action.dataset.debugAction === "random-client") {
        state.clientProfile = createRandomPreferenceProfile();
        state.clientNotice = "";
      } else {
        return false;
      }
      render(root, state);
      return true;
    },
  });
}

function createClientPanel(cocktail, profile, nextStored, nextRandom, notice = "") {
  const satisfaction = evaluateClientSatisfaction(cocktail, profile);
  const preferenceByTagId = new Map(satisfaction.preferences.map((preference) => [preference.tagId, preference]));
  const panel = node("section", "cocktail-panel client-panel");
  const clientHeading = node("div", "panel-heading");
  const title = node("div", ""); title.append(node("p", "eyebrow", "Клиент"), node("h2", "", profile.name));
  const controls = node("div", "panel-heading-actions");
  [["Постоянный клиент", nextStored], ["Случайный клиент", nextRandom]].forEach(([label, action]) => { const button = node("button", "secondary-button compact-button", label); button.addEventListener("click", action); controls.append(button); });
  clientHeading.append(title, controls); panel.append(clientHeading);
  const columns = [
    PREFERENCE_ATTITUDE.stronglyDislike,
    PREFERENCE_ATTITUDE.dislike,
    PREFERENCE_ATTITUDE.like,
    PREFERENCE_ATTITUDE.stronglyLike,
  ];
  const table = node("table", "client-preference-table");
  const headerRow = document.createElement("tr");
  columns.forEach((attitude) => headerRow.append(node("th", "", PREFERENCE_ATTITUDE_LABEL[attitude])));
  const header = document.createElement("thead");
  header.append(headerRow);
  const preferenceRow = document.createElement("tr");
  columns.forEach((attitude) => {
    const cell = document.createElement("td");
    const tags = node("div", "client-preference-tags");
    profile.preferences
      .filter((preference) => preference.attitude === attitude)
      .forEach((preference) => {
        const definition = TAG_DEFINITIONS[preference.tagId];
        const evaluated = preferenceByTagId.get(preference.tagId);
        const tag = node("span", "cocktail-tag tag-" + definition.category, preference.degree ? definition.label + " " + preference.degree : definition.label);
        const showMarker = preference.attitude < 0 ? evaluated?.present : evaluated?.satisfied;
        if (showMarker) {
          const marker = node("span", "preference-progress " + (preference.attitude < 0 ? "negative" : evaluated.degreeDifference ? "partial" : "positive"), preference.attitude < 0 ? "×" : "✓");
          marker.setAttribute("aria-label", preference.attitude < 0 ? "Нежелательный тег добавлен" : evaluated.degreeDifference ? "Частично удовлетворено" : "Удовлетворено");
          tag.append(marker);
        }
        tags.append(tag);
      });
    cell.append(tags);
    preferenceRow.append(cell);
  });
  const body = document.createElement("tbody");
  body.append(preferenceRow);
  table.append(header, body);
  panel.append(table);
  if (notice) panel.append(node("p", "nighttime-client-notice", notice));
  return panel;
}

function createTagPanel(cocktail) {
  const panel = node("section", "cocktail-panel");
  panel.append(node("p", "eyebrow", "Свойства"), node("h2", "", "Теги напитка"));
  const tagGroups = node("div", "tag-groups");
  if (!cocktail.tags.length) tagGroups.append(node("span", "muted", "Добавьте ингредиенты."));
  Object.keys(categoryLabels).forEach((category) => {
    const tags = cocktail.tags.filter((tag) => tag.category === category);
    if (!tags.length) return;
    const group = node("section", "tag-category");
    const tagList = node("div", "tag-list");
    tags.forEach((tag) => tagList.append(node("span", "cocktail-tag tag-" + tag.category, formatTagLabel(tag))));
    group.append(node("h3", "", categoryLabels[category]), tagList);
    tagGroups.append(group);
  });
  panel.append(tagGroups);
  return panel;
}

function createSatisfactionScale(score) {
  const scale = node("div", "satisfaction-scale");
  const progress = node("div", "satisfaction-scale-progress");
  progress.style.setProperty("--satisfaction-progress", Math.max(0, Math.min(10, score)) * 10 + "%");
  scale.append(progress);
  [5, 10].forEach((threshold) => {
    const marker = node("span", "satisfaction-threshold", String(threshold));
    marker.style.setProperty("--threshold-position", threshold * 10 + "%");
    scale.append(marker);
  });
  return scale;
}

function createResultPanel(cocktail, profile, onNextClient) {
  const result = evaluateClientSatisfaction(cocktail, profile);
  const panel = node("section", "cocktail-panel satisfaction-panel");
  const resultHeading = node("div", "satisfaction-heading");
  const title = node("div", "");
  title.append(node("p", "eyebrow", "Результат"), node("h2", "", "Удовлетворение клиента"));
  const nextClient = node("button", "primary-button compact-button next-client-button", "Следующий клиент");
  nextClient.type = "button";
  nextClient.addEventListener("click", onNextClient);
  resultHeading.append(title, nextClient);
  panel.append(resultHeading);
  const score = node("strong", "satisfaction-score" + (result.score >= 0 ? " positive" : " negative"), (result.score >= 0 ? "+" : "") + result.score);
  panel.append(score, createSatisfactionScale(result.score));
  if (result.score >= 10) panel.append(node("p", "satisfaction-effect grand", "✦ Клиент в восторге"));
  else if (result.score >= 5) panel.append(node("p", "satisfaction-effect", "✦ Клиент заметно доволен"));
  const list = node("ul", "satisfaction-list");
  result.preferences.forEach((preference) => {
    const item = node("li", "satisfaction-item " + (preference.satisfied ? "satisfied" : "unsatisfied"));
    item.textContent = preference.label + (preference.degree ? " " + preference.degree : "") + ": " + (preference.satisfied ? "учтено" : "не учтено") + " (" + (preference.score >= 0 ? "+" : "") + preference.score + ")";
    list.append(item);
  });
  panel.append(list);
  return panel;
}

function syncSharedSettings(mode, state, root) {
  const shell = document.querySelector(".game-shell");
  const toggle = document.querySelector("#settingsToggleButton");
  const panel = document.querySelector("#settingsPanel");
  if (!shell || !toggle || !panel) return;
  shell.append(toggle, panel);
  const cocktailsTab = panel.querySelector('[data-settings-tab="cocktails"]') || node("button", "settings-tab", "Коктейли");
  cocktailsTab.type = "button";
  cocktailsTab.id = "settingsCocktailsTab";
  cocktailsTab.setAttribute("role", "tab");
  cocktailsTab.setAttribute("aria-controls", "settingsCocktailsPanel");
  cocktailsTab.dataset.settingsTab = "cocktails";
  const tabs = panel.querySelector(".settings-tabs");
  if (!cocktailsTab.parentElement) tabs.append(cocktailsTab);
  const cocktailsPanel = panel.querySelector('[data-settings-tab-panel="cocktails"]') || node("div", "settings-grid");
  cocktailsPanel.id = "settingsCocktailsPanel";
  cocktailsPanel.setAttribute("role", "tabpanel");
  cocktailsPanel.setAttribute("aria-labelledby", "settingsCocktailsTab");
  cocktailsPanel.dataset.settingsTabPanel = "cocktails";
  if (!cocktailsPanel.parentElement) panel.append(cocktailsPanel);
  const settings = getNighttimeSettings();
  cocktailsPanel.replaceChildren();
  const min = node("input", "");
  min.type = "number"; min.min = "1"; min.max = "12"; min.value = String(settings.preferenceMin);
  const max = node("input", "");
  max.type = "number"; max.min = "1"; max.max = "12"; max.value = String(settings.preferenceMax);
  const filmMode = node("select", "");
  [["linked", "4 связанные вариации"], ["all", "16 комбинаций"]].forEach(([value, label]) => { const option = node("option", "", label); option.value = value; option.selected = settings.filmCombinationMode === value; filmMode.append(option); });
  const apply = () => { updateNighttimeSettings({ preferenceMin: min.value, preferenceMax: max.value, filmCombinationMode: filmMode.value }); render(root, state); };
  const resourceLimited = node("input", "");
  resourceLimited.type = "checkbox";
  resourceLimited.checked = settings.resourceLimited;
  const resourceRandomMin = node("input", "");
  resourceRandomMin.type = "number"; resourceRandomMin.min = "0"; resourceRandomMin.max = "99"; resourceRandomMin.value = String(settings.resourceRandomMin);
  const resourceRandomMax = node("input", "");
  resourceRandomMax.type = "number"; resourceRandomMax.min = "0"; resourceRandomMax.max = "99"; resourceRandomMax.value = String(settings.resourceRandomMax);
  const satisfactionLikeBase = node("input", "");
  satisfactionLikeBase.type = "number"; satisfactionLikeBase.min = "0"; satisfactionLikeBase.max = "99"; satisfactionLikeBase.value = String(settings.satisfactionLikeBase);
  const satisfactionStronglyLikeBase = node("input", "");
  satisfactionStronglyLikeBase.type = "number"; satisfactionStronglyLikeBase.min = "0"; satisfactionStronglyLikeBase.max = "99"; satisfactionStronglyLikeBase.value = String(settings.satisfactionStronglyLikeBase);
  const balancedPreferences = node("input", "");
  balancedPreferences.type = "checkbox"; balancedPreferences.checked = settings.balancedPreferences;
  const applyResources = () => {
    const nextSettings = updateNighttimeSettings({
      preferenceMin: min.value,
      preferenceMax: max.value,
      filmCombinationMode: filmMode.value,
      resourceLimited: resourceLimited.checked,
      resourceRandomMin: resourceRandomMin.value,
      resourceRandomMax: resourceRandomMax.value,
      satisfactionLikeBase: satisfactionLikeBase.value,
      satisfactionStronglyLikeBase: satisfactionStronglyLikeBase.value,
      balancedPreferences: balancedPreferences.checked,
    });
    if (nextSettings.resourceLimited && (nextSettings.resourceRandomMin !== settings.resourceRandomMin || nextSettings.resourceRandomMax !== settings.resourceRandomMax || nextSettings.resourceLimited !== settings.resourceLimited)) rollComponents(state);
    if (!nextSettings.resourceLimited && settings.resourceLimited) { state.slots = {}; state.preparation = {}; state.prepared = false; }
    render(root, state);
  };
  min.addEventListener("change", apply); max.addEventListener("change", apply); filmMode.addEventListener("change", apply);
  resourceLimited.addEventListener("change", applyResources); resourceRandomMin.addEventListener("change", applyResources); resourceRandomMax.addEventListener("change", applyResources); satisfactionLikeBase.addEventListener("change", applyResources); satisfactionStronglyLikeBase.addEventListener("change", applyResources); balancedPreferences.addEventListener("change", applyResources);
  const minLabel = node("label", "editor-field"); minLabel.append(node("span", "", "Мин. предпочтений"), min);
  const maxLabel = node("label", "editor-field"); maxLabel.append(node("span", "", "Макс. предпочтений"), max);
  const modeLabel = node("label", "editor-field wide"); modeLabel.append(node("span", "", "Комбинация плёнок"), filmMode);
  const limitedLabel = node("label", "editor-field wide"); limitedLabel.append(node("span", "", "Ограниченность ресурсов"), resourceLimited);
  const resourceMinLabel = node("label", "editor-field"); resourceMinLabel.append(node("span", "", "Мин. компонентов"), resourceRandomMin);
  const resourceMaxLabel = node("label", "editor-field"); resourceMaxLabel.append(node("span", "", "Макс. компонентов"), resourceRandomMax);
  const satisfactionLikeLabel = node("label", "editor-field"); satisfactionLikeLabel.append(node("span", "", "База: хочет"), satisfactionLikeBase);
  const satisfactionStronglyLikeLabel = node("label", "editor-field"); satisfactionStronglyLikeLabel.append(node("span", "", "База: очень хочет"), satisfactionStronglyLikeBase);
  const balancedPreferencesLabel = node("label", "editor-field wide"); balancedPreferencesLabel.append(node("span", "", "Равномерные предпочтения"), balancedPreferences);
  cocktailsPanel.append(minLabel, maxLabel, modeLabel, limitedLabel, resourceMinLabel, resourceMaxLabel, satisfactionLikeLabel, satisfactionStronglyLikeLabel, balancedPreferencesLabel);
  const nightOnly = mode === "nighttime";
  const fullMode = mode === "full";
  panel.dataset.settingsMode = mode;
  panel.querySelectorAll("[data-settings-tab], [data-settings-tab-panel]").forEach((element) => {
    const isCocktails = (element.dataset.settingsTab || element.dataset.settingsTabPanel) === "cocktails";
    element.hidden = !fullMode && (nightOnly ? !isCocktails : isCocktails);
  });
  if (nightOnly) {
    cocktailsTab.classList.add("active");
    cocktailsTab.setAttribute("aria-selected", "true");
    cocktailsPanel.hidden = false;
    if (!toggle.dataset.nighttimeBound) {
      toggle.dataset.nighttimeBound = "true";
      toggle.addEventListener("click", () => {
        state.settingsOpen = !state.settingsOpen;
        panel.classList.toggle("open", state.settingsOpen);
        panel.setAttribute("aria-hidden", String(!state.settingsOpen));
        panel.inert = !state.settingsOpen;
      });
      panel.querySelector("#closeSettingsButton").addEventListener("click", () => {
        state.settingsOpen = false;
        panel.classList.remove("open");
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
      });
    }
    panel.classList.toggle("open", state.settingsOpen);
    panel.setAttribute("aria-hidden", String(!state.settingsOpen));
    panel.inert = !state.settingsOpen;
  } else if (fullMode) {
    const activeTab = panel.querySelector("[data-settings-tab].active")?.dataset.settingsTab || "tasks";
    panel.querySelectorAll("[data-settings-tab]").forEach((tab) => {
      const isActive = tab.dataset.settingsTab === activeTab;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panel.querySelectorAll("[data-settings-tab-panel]").forEach((tabPanel) => {
      tabPanel.hidden = tabPanel.dataset.settingsTabPanel !== activeTab;
    });
  }
}

function bindClientEditorNavigation(content, state) {
  if (content.dataset.nighttimeClientNavigationBound) return;
  content.dataset.nighttimeClientNavigationBound = "true";
  const rerender = () => render(document.querySelector("#nighttimeRoot"), state);
  content.addEventListener("click", (event) => {
    const open = event.target.closest("[data-client-open]");
    if (open) { state.clientEditorId = open.dataset.clientOpen; rerender(); return; }
    const select = event.target.closest("[data-client-select]");
    if (select?.dataset.clientSelect) { state.clientEditorId = select.dataset.clientSelect; rerender(); return; }
    if (event.target.closest("[data-client-back]")) { state.clientEditorId = ""; rerender(); return; }
    if (event.target.closest("[data-client-delete]")) { deleteClient(state.clientEditorId); state.clientEditorId = ""; }
  });
  content.addEventListener("change", (event) => {
    const picker = event.target.closest("[data-client-picker]");
    if (!picker) return;
    state.clientEditorId = picker.value;
    rerender();
  });
}

function syncSharedEditor(mode, state) {
  const shell = document.querySelector(".game-shell");
  const toggle = document.querySelector("#modeToggleButton");
  const panel = document.querySelector("#editorPanel");
  const profileBar = document.querySelector("#editorProfileBar");
  const tabs = document.querySelector("#editorTabs");
  const content = document.querySelector("#editorContent");
  if (!shell || !toggle || !panel || !profileBar || !tabs || !content || (mode !== "nighttime" && mode !== "full")) return;
  if (mode === "full") return;
  bindClientEditorNavigation(content, state);
  const previousPanelScrollTop = panel.scrollTop;
  const previousContentScrollTop = content.scrollTop;
  shell.append(toggle, profileBar, panel);
  tabs.innerHTML = `<button class="editor-tab${state.editorTab === "components" ? " active" : ""}" type="button" data-editor-tab="components">Компоненты</button><button class="editor-tab${state.editorTab === "clients" ? " active" : ""}" type="button" data-editor-tab="clients">Клиенты</button>`;
  content.innerHTML = state.editorTab === "clients" ? renderClientEditor(state.clientEditorId) : renderComponentEditor();
  profileBar.hidden = false;
  profileBar.innerHTML = renderComponentEditorProfileBar();
  ["#resetEditorDraftButton", "#saveEditorButton", "#publishEditorButton"].forEach((selector) => { panel.querySelector(selector).hidden = true; });
  const collapseButton = panel.querySelector("#collapseEditorButton");
  const syncEditorVisibility = () => {
    panel.classList.toggle("open", state.editing);
    panel.classList.toggle("collapsed", state.editorCollapsed);
    panel.setAttribute("aria-hidden", String(!state.editing));
    panel.inert = !state.editing;
    profileBar.classList.toggle("open", state.editing);
    profileBar.setAttribute("aria-hidden", String(!state.editing));
    profileBar.inert = !state.editing;
    collapseButton.textContent = state.editorCollapsed ? "Развернуть" : "Свернуть";
  };
  syncEditorVisibility();
  bindComponentEditorEvents();
  bindClientEditor();
  const restoreEditorScroll = () => {
    panel.scrollTop = previousPanelScrollTop;
    content.scrollTop = previousContentScrollTop;
  };
  restoreEditorScroll();
  requestAnimationFrame(restoreEditorScroll);
  tabs.querySelectorAll("[data-editor-tab]").forEach((tab) => tab.addEventListener("click", () => { state.editorTab = tab.dataset.editorTab; render(document.querySelector("#nighttimeRoot"), state); }));
  if (!toggle.dataset.nighttimeEditorBound) {
    toggle.dataset.nighttimeEditorBound = "true";
    toggle.addEventListener("click", () => {
      state.editing = !state.editing;
      syncEditorVisibility();
      toggle.innerHTML = state.editing ? '<span class="button-icon" aria-hidden="true">▶</span>Игра' : '<span class="button-icon" aria-hidden="true">✎</span>Редактор';
      render(document.querySelector("#nighttimeRoot"), state);
    });
    collapseButton.addEventListener("click", () => {
      state.editorCollapsed = !state.editorCollapsed;
      syncEditorVisibility();
    });
  }
}

function createBarAdditivesPanel(root, state) {
  const profileId = getActiveComponentProfileId();
  if (state.barProfileId !== profileId) {
    state.barSlots = loadBarAdditiveSlots(profileId);
    state.barProfileId = profileId;
    state.barPickerSlot = null;
  }
  state.barSlots = normalizeBarAdditiveSlots(state.barSlots);
  const panel = node("section", "cocktail-panel bar-additives-panel");
  panel.setAttribute("aria-label", "Барные добавки");
  panel.append(node("h2", "", "Барные добавки"));
  const shelf = node("div", "bar-additive-slots");
  state.barSlots.forEach((ingredientId, index) => {
    const entry = getIngredientById(ingredientId);
    const cell = node("div", "bar-additive-cell");
    const button = node("button", "ingredient-button bar-additive-slot" + (entry ? " filled" : " empty"));
    button.type = "button";
    button.dataset.barSlot = String(index);
    button.dataset.ingredientId = entry?.id || "";
    button.setAttribute("aria-label", entry ? `Добавить в коктейль: ${entry.name}` : `Выбрать барную добавку: слот ${index + 1}`);
    button.disabled = Boolean(entry && (state.editing || !getAvailableSlot(state.slots, entry)));
    const title = node("strong", "", entry?.name || "+ Выбрать добавку");
    if (entry) title.append(node("span", "ingredient-quantity", "∞"));
    button.append(title);
    if (entry) button.append(ingredientTagList(entry));
    button.addEventListener("click", () => {
      if (!entry) { state.barPickerSlot = index; render(root, state); return; }
      const slot = getAvailableSlot(state.slots, entry);
      if (!state.editing && slot) { state.slots[slot.id] = entry.id; state.prepared = false; render(root, state); }
    });
    cell.append(button);
    if (entry && state.editing) {
      const clear = node("button", "icon-button bar-additive-clear", "×");
      clear.type = "button";
      clear.dataset.barClear = String(index);
      clear.setAttribute("aria-label", `Очистить барный слот: ${entry.name}`);
      clear.addEventListener("click", () => {
        state.barSlots = saveBarAdditiveSlots(setBarAdditiveSlot(state.barSlots, index, ""));
        state.barPickerSlot = null;
        render(root, state);
      });
      cell.append(clear);
    }
    shelf.append(cell);
  });
  panel.append(shelf, node("p", "bar-additive-hint", state.editing ? "Очистите ячейку крестиком, чтобы выбрать другую добавку." : "Запас бесконечный. Для замены добавки включите редактор."));
  if (state.barPickerSlot !== null) {
    const picker = node("aside", "cocktail-panel bar-additive-picker");
    picker.setAttribute("aria-label", "Выбор барной добавки");
    const heading = node("div", "panel-heading");
    const close = node("button", "icon-button", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть выбор добавки");
    close.addEventListener("click", () => { state.barPickerSlot = null; render(root, state); });
    heading.append(node("h2", "", "Выберите добавку"), close);
    picker.append(heading);
    const choices = getIngredients().filter(isBarAdditive);
    choices.forEach((entry) => {
      const button = node("button", "ingredient-button");
      button.type = "button";
      button.dataset.barChoice = entry.id;
      button.disabled = state.barSlots.includes(entry.id);
      button.append(node("strong", "", entry.name), ingredientTagList(entry));
      if (button.disabled) button.append(node("span", "muted", "Уже выбрана"));
      button.addEventListener("click", () => {
        state.barSlots = saveBarAdditiveSlots(setBarAdditiveSlot(state.barSlots, state.barPickerSlot, entry.id));
        state.barPickerSlot = null;
        render(root, state);
      });
      picker.append(button);
    });
    if (!choices.length) picker.append(node("p", "muted", "Барных добавок нет. Добавьте их в редакторе компонентов."));
    panel.append(picker);
  }
  return panel;
}

function render(root, state) {
  const cocktail = buildCocktail(state.slots, state.preparation);
  root.replaceChildren();
  const workbench = node("div", "cocktail-workbench");
  const settings = getNighttimeSettings();
  const activeIngredients = getIngredients().filter((entry) => !isBarAdditive(entry) && (entry.type !== "film" || settings.filmCombinationMode === "all" || LINKED_FILM_IDS.includes(entry.id)) && (!settings.resourceLimited || getIngredientUnits(state, entry.id) > 0));
  const buildPanel = node("section", "cocktail-panel");
  const panelHeading = node("div", "panel-heading");
  const clear = node("button", "secondary-button compact-button", "Очистить");
  clear.type = "button";
  clear.addEventListener("click", () => { state.slots = {}; state.preparation = {}; state.prepared = false; render(root, state); });
  panelHeading.append(node("h2", "", "Коктейль"), clear);
  const slots = node("div", "cocktail-slots");
  COCKTAIL_SLOT_CONFIG.forEach((slot) => {
    const entry = getIngredientById(state.slots[slot.id]);
    const card = node("div", "cocktail-slot" + (entry ? " filled" : ""));
    card.dataset.slotId = slot.id;
    card.append(node("span", "", slot.label), node("strong", "", entry?.name || "Пусто"));
    if (entry) card.append(ingredientTagList(entry));
    if (entry) {
      const remove = node("button", "", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Убрать " + entry.name);
      remove.addEventListener("click", () => { delete state.slots[slot.id]; state.prepared = false; render(root, state); });
      card.append(remove);
    }
    slots.append(card);
  });
  const preparationControls = node("div", "nighttime-preparation-controls");
  [
    ["cold", "Добавить льда", () => { state.preparation.cold = true; state.preparation.warm = false; }],
    ["warm", "Подогреть", () => { state.preparation.warm = true; state.preparation.cold = false; }],
    ["mixed", "Перемешать", () => { state.preparation.mixed = true; }],
  ].forEach(([key, label, apply]) => {
    const button = node("button", "secondary-button compact-button" + (state.preparation[key] ? " active" : ""), label);
    button.type = "button";
    button.disabled = !cocktail.isComplete;
    button.addEventListener("click", () => { apply(); state.prepared = false; render(root, state); });
    preparationControls.append(button);
  });
  const prepare = node("button", "primary-button nighttime-prepare", "Приготовить напиток");
  prepare.type = "button";
  prepare.disabled = !cocktail.isComplete || state.prepared || (settings.resourceLimited && !hasComponentsForSlots(state.inventory, state.slots));
  prepare.addEventListener("click", () => {
    if (settings.resourceLimited && !hasComponentsForSlots(state.inventory, state.slots)) return;
    if (settings.resourceLimited) state.inventory = consumeComponents(state.inventory, state.slots);
    state.prepared = true;
    render(root, state);
  });
  buildPanel.append(panelHeading, slots, preparationControls, prepare, node("p", "nighttime-result", state.prepared ? "Напиток готов. Компоненты списаны из запаса." : "Для приготовления нужен хотя бы один большой компонент."));

  const leftColumn = node("div", "nighttime-left-column");
  const resetClient = (profile) => { state.clientProfile = profile; state.clientNotice = ""; state.slots = {}; state.preparation = {}; state.prepared = false; render(root, state); };
  const nextStoredClient = () => {
    const client = getRandomStoredClient(Math.random, state.seenStoredClientIds);
    if (!client) { state.clientNotice = "Все постоянные клиенты уже были сегодня."; render(root, state); return; }
    state.seenStoredClientIds.add(client.id);
    resetClient(client);
  };
  leftColumn.append(createClientPanel(cocktail, state.clientProfile, nextStoredClient, () => resetClient(createRandomPreferenceProfile()), state.clientNotice));
  leftColumn.append(state.prepared
    ? createResultPanel(cocktail, state.clientProfile, () => {
      state.clientProfile = createRandomPreferenceProfile();
      state.slots = {};
      state.preparation = {};
      state.prepared = false;
      render(root, state);
    })
    : createTagPanel(cocktail));

  const ingredientPanel = node("section", "cocktail-panel ingredient-panel");
  const ingredientHeading = node("div", "panel-heading");
  const ingredientTitle = node("div", "");
  ingredientTitle.append(node("p", "eyebrow", "Компоненты"), node("h2", "", "Выберите ингредиент"));
  if (settings.resourceLimited) {
    const reroll = node("button", "secondary-button compact-button", "Случайные компоненты");
    reroll.type = "button";
    reroll.addEventListener("click", () => { rollComponents(state); render(root, state); });
    ingredientHeading.append(ingredientTitle, reroll);
  } else ingredientHeading.append(ingredientTitle);
  ingredientPanel.append(ingredientHeading);
  const groups = node("div", "ingredient-groups");
  Object.entries(groupLabels).forEach(([type, label]) => {
    const group = node("div", "");
    group.dataset.ingredientGroup = type;
    group.append(node("h3", "", label));
    if (type === "film" && getNighttimeSettings().filmCombinationMode === "all") {
      group.className = "film-combination-controls";
      const flavorSelect = node("select", "film-tag-select");
      const benefitSelect = node("select", "film-tag-select");
      filmFlavorIds.forEach((tagId) => { const option = node("option", "", TAG_DEFINITIONS[tagId].label); option.value = tagId; option.selected = state.filmFlavor === tagId; flavorSelect.append(option); });
      filmBenefitIds.forEach((tagId) => { const option = node("option", "", tagId === "neutral" ? "Без тега пользы" : TAG_DEFINITIONS[tagId].label); option.value = tagId; option.selected = state.filmBenefit === tagId; benefitSelect.append(option); });
      const addFilm = node("button", "secondary-button compact-button film-add-button", "Добавить плёнку");
      addFilm.type = "button";
      const selectedFilm = getIngredientById("film-" + state.filmFlavor + "-" + state.filmBenefit);
      addFilm.disabled = !getAvailableSlot(state.slots, selectedFilm) || getIngredientUnits(state, selectedFilm.id) < 1;
      addFilm.addEventListener("click", () => { const slot = getAvailableSlot(state.slots, selectedFilm); if (slot) { state.slots[slot.id] = selectedFilm.id; state.prepared = false; render(root, state); } });
      flavorSelect.addEventListener("change", () => { state.filmFlavor = flavorSelect.value; render(root, state); });
      benefitSelect.addEventListener("change", () => { state.filmBenefit = benefitSelect.value; render(root, state); });
      group.append(flavorSelect, benefitSelect, addFilm);
      groups.append(group);
      return;
    }
    activeIngredients.filter((entry) => entry.type === type).forEach((entry) => {
      const button = node("button", "ingredient-button");
      button.type = "button";
      button.disabled = !getAvailableSlot(state.slots, entry) || getIngredientUnits(state, entry.id) < 1;
      const title = node("strong", "", entry.name);
      title.append(node("span", "ingredient-quantity", settings.resourceLimited ? "×" + getIngredientUnits(state, entry.id) : "∞"));
      button.append(title, ingredientTagList(entry));
      button.addEventListener("click", () => { const slot = getAvailableSlot(state.slots, entry); if (slot) { state.slots[slot.id] = entry.id; state.prepared = false; render(root, state); } });
      group.append(button);
    });
    groups.append(group);
  });
  ingredientPanel.append(groups);
  const componentsColumn = node("div", "nighttime-components-column");
  componentsColumn.append(ingredientPanel, createBarAdditivesPanel(root, state));
  workbench.append(leftColumn, buildPanel, componentsColumn);
  syncSharedSettings(state.mode, state, root);
  syncSharedEditor(state.mode, state);
  root.append(workbench);
}

export function bootstrapNighttime({ adapter, mode }) {
  const root = document.querySelector("#nighttimeRoot");
  if (!root) return { adapter, mode };
  const settlement = adapter?.readDaytimeSettlement();
  const state = {
    mode,
    day: settlement?.day || 1,
    resourceCount: Object.keys(settlement?.resources || {}).length,
    slots: {},
    preparation: {},
    prepared: false,
    settingsOpen: false,
    editing: mode === "full" && document.body.classList.contains("edit-mode"),
    editorCollapsed: false,
    editorTab: "components",
    clientEditorId: "",
    seenStoredClientIds: new Set(),
    clientNotice: "",
    filmFlavor: "bitter",
    filmBenefit: "invigorating",
    barProfileId: null,
    barSlots: [],
    barPickerSlot: null,
    inventory: createRandomComponentInventory(getIngredients(), getNighttimeSettings()),
    clientProfile: createRandomPreferenceProfile(),
  };
  root.dataset.phaseMode = mode;
  registerNighttimeDebugCheats(state, root);
  window.addEventListener("nighttime-components-changed", () => render(root, state));
  window.addEventListener("nighttime-clients-changed", () => render(root, state));
  if (mode === "full") {
    document.querySelector("#modeToggleButton")?.addEventListener("click", () => {
      state.editing = document.body.classList.contains("edit-mode");
      state.barPickerSlot = null;
      render(root, state);
    });
  }
  render(root, state);
  return { adapter, mode };
}
