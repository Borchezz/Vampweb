import { gameSettings, interfaceThemeOptions, runtime, taskMechanicOptions } from "./state.js";
import { dom } from "./dom.js";
import { escapeAttribute, escapeHtml } from "./rules.js";
import { formatSignedNumber, getSympathyScaleSections } from "./agent-traits.js";
import { getTaskMechanicSettingOptions } from "./task-mechanic-registry.js";

export function renderSelectOptions(options, selectedValue, formatter = (value) => value) {
  return options
    .map((option) => {
      const value = typeof option === "object" ? option.value : option;
      const label = typeof option === "object" ? option.label : formatter(option);
      return `<option value="${escapeAttribute(value)}" ${String(value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderSympathyScalePreview() {
  return getSympathyScaleSections()
    .map(
      (section) => `
        <div class="settings-sympathy-section ${section.section === 0 ? "zero" : ""}">
          <strong>${escapeHtml(section.label)}</strong>
          <span>${escapeHtml(formatSignedNumber(section.mod))} к восст.</span>
          <small>${escapeHtml(section.rangeLabel)}</small>
        </div>
      `
    )
    .join("");
}

function renderTaskDifficultyLevels() {
  return gameSettings.taskDifficultyLevels
    .map(
      (level, index) => `
        <div class="settings-difficulty-row">
          <label class="editor-field">
            <span>Название</span>
            <input type="text" value="${escapeAttribute(level.name)}" data-task-difficulty-level="${index}" data-task-difficulty-field="name" />
          </label>
          <label class="editor-field">
            <span>Число</span>
            <input type="number" step="1" value="${escapeAttribute(level.value)}" data-task-difficulty-level="${index}" data-task-difficulty-field="value" />
          </label>
        </div>
      `
    )
    .join("");
}

function renderSettingsTabs() {
  const activeTab = runtime.settingsTab || "tasks";
  dom.settingsPanel.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const isActive = button.dataset.settingsTab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  dom.settingsPanel.querySelectorAll("[data-settings-tab-panel]").forEach((panel) => {
    const isActive = panel.dataset.settingsTabPanel === activeTab;
    panel.hidden = !isActive;
  });
}

function applyInterfaceTheme() {
  const paperThemeEnabled = gameSettings.interfaceTheme === "paper";
  document.body.classList.toggle("theme-paper", paperThemeEnabled);
  document.body.classList.toggle("theme-classic", !paperThemeEnabled);
}

export function renderSettingsPanel() {
  applyInterfaceTheme();
  dom.settingsPanel.classList.toggle("open", runtime.settingsPanelOpen);
  dom.settingsPanel.setAttribute("aria-hidden", String(!runtime.settingsPanelOpen));
  dom.settingsPanel.inert = !runtime.settingsPanelOpen;
  renderSettingsTabs();
  dom.taskMechanicSelect.innerHTML = renderSelectOptions(taskMechanicOptions, gameSettings.taskMechanic);
  dom.baseDieSelect.innerHTML = renderSelectOptions(
    getTaskMechanicSettingOptions("baseDie", gameSettings.taskMechanic),
    gameSettings.baseDie,
    (value) => `d${value}`
  );
  dom.advantageDieSelect.innerHTML = renderSelectOptions(
    getTaskMechanicSettingOptions("advantageDie", gameSettings.taskMechanic),
    gameSettings.advantageDie,
    (value) => `d${value}`
  );
  dom.taskDifficultyCountInput.value = gameSettings.taskDifficultyLevels.length;
  dom.taskDifficultyList.innerHTML = renderTaskDifficultyLevels();
  dom.sympathyMinInput.value = gameSettings.sympathyMin;
  dom.sympathyStartInput.value = gameSettings.sympathyStart;
  dom.sympathyMaxInput.value = gameSettings.sympathyMax;
  dom.sympathySectionsInput.value = gameSettings.sympathySections;
  dom.mainCharacterSympathyInput.value = gameSettings.mainCharacterSympathyEnabled ? "enabled" : "disabled";
  dom.sympathyScalePreview.innerHTML = renderSympathyScalePreview();
  dom.interfaceThemeInputs.forEach((input) => {
    input.checked = input.value === gameSettings.interfaceTheme;
    input.disabled = !interfaceThemeOptions.some((option) => option.value === input.value);
  });
}
