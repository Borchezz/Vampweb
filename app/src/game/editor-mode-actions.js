import { editorState, gameSettings, normalizeSympathyGameSettings, persistenceSettings, runtime, sanitizeInterfaceTheme, state } from "./state.js";
import { saveEditorDraft, savePersistenceSettings, setGitlabToken } from "./persistence.js";
import { render, renderSettingsPanel } from "./render-core.js";
import { renderEditor } from "./editor-render.js";
import { showToast } from "./actions.js";
import { sanitizeTaskMechanicId, sanitizeTaskMechanicSetting } from "./task-mechanic-registry.js";
import { normalizeTaskDifficultyLevels } from "./task-difficulty-settings.js";
import { recordEditorChange } from "./rules.js";

export function setUpgradeMenuOpen(isOpen) {
  runtime.upgradePanelOpen = isOpen;
  if (isOpen) {
    runtime.inventoryPanelOpen = false;
    runtime.journalPanelOpen = false;
    runtime.barPanelOpen = false;
  }
  render();
}

export function setInventoryPanelOpen(isOpen) {
  runtime.inventoryPanelOpen = isOpen;
  if (isOpen) {
    runtime.journalPanelOpen = false;
    runtime.upgradePanelOpen = false;
    runtime.barPanelOpen = false;
  }
  render();
}

export function setJournalPanelOpen(isOpen) {
  runtime.journalPanelOpen = isOpen;
  if (isOpen) {
    runtime.inventoryPanelOpen = false;
    runtime.upgradePanelOpen = false;
    runtime.barPanelOpen = false;
  }
  render();
}

export function setBarPanelOpen(isOpen) {
  runtime.barPanelOpen = isOpen;
  if (isOpen) {
    runtime.inventoryPanelOpen = false;
    runtime.journalPanelOpen = false;
    runtime.upgradePanelOpen = false;
  }
  render();
}

export function setSettingsPanelOpen(isOpen) {
  runtime.settingsPanelOpen = isOpen;
  renderSettingsPanel();
}

export function handleSettingsTabChange(button) {
  runtime.settingsTab = button.dataset.settingsTab || "tasks";
  renderSettingsPanel();
}

export function ensurePlayMode() {
  if (runtime.appMode !== "edit") return true;
  showToast("Сначала вернитесь в режим игры.");
  return false;
}

export function setAppMode(mode) {
  runtime.appMode = mode;
  if (runtime.appMode === "edit") {
    Object.keys(editorState.entityViews).forEach((key) => {
      editorState.entityViews[key] = "list";
    });
    state.locationPanelOpen = false;
    runtime.inventoryPanelOpen = false;
    runtime.journalPanelOpen = false;
    runtime.upgradePanelOpen = false;
    runtime.barPanelOpen = false;
    state.openLocationShopId = "";
    state.routePlanner.planning = false;
  } else {
    runtime.zoneLabelDragZoneId = "";
    runtime.pathEndpointEditMode = false;
  }
  saveEditorDraft();
  render();
}

export function handleGameSettingsChange(input) {
  const sympathySettingByInputId = {
    sympathyMinInput: "sympathyMin",
    sympathyStartInput: "sympathyStart",
    sympathyMaxInput: "sympathyMax",
    sympathySectionsInput: "sympathySections",
  };

  if (input.id === "taskMechanicSelect") {
    gameSettings.taskMechanic = sanitizeTaskMechanicId(input.value);
    gameSettings.baseDie = sanitizeTaskMechanicSetting("baseDie", gameSettings.baseDie, gameSettings.taskMechanic);
    gameSettings.advantageDie = sanitizeTaskMechanicSetting("advantageDie", gameSettings.advantageDie, gameSettings.taskMechanic);
  } else if (input.id === "baseDieSelect") {
    gameSettings.baseDie = sanitizeTaskMechanicSetting("baseDie", input.value, gameSettings.taskMechanic);
  } else if (input.id === "advantageDieSelect") {
    gameSettings.advantageDie = sanitizeTaskMechanicSetting("advantageDie", input.value, gameSettings.taskMechanic);
  } else if (input.name === "interfaceTheme") {
    gameSettings.interfaceTheme = sanitizeInterfaceTheme(input.value);
  } else if (input.id === "mainCharacterSympathyInput") {
    gameSettings.mainCharacterSympathyEnabled = input.value === "enabled";
  } else if (sympathySettingByInputId[input.id]) {
    gameSettings[sympathySettingByInputId[input.id]] = Number(input.value);
    Object.assign(gameSettings, normalizeSympathyGameSettings(gameSettings));
  } else if (input.id === "taskDifficultyCountInput") {
    const count = Math.max(1, Math.min(12, Math.trunc(Number(input.value)) || 1));
    const levels = normalizeTaskDifficultyLevels(gameSettings.taskDifficultyLevels);
    while (levels.length < count) {
      const index = levels.length;
      levels.push({ id: `difficulty-${index + 1}`, name: `Сложность ${index + 1}`, value: index + 7 });
    }
    gameSettings.taskDifficultyLevels = normalizeTaskDifficultyLevels(levels.slice(0, count));
  } else if (input.dataset.taskDifficultyLevel) {
    const index = Number(input.dataset.taskDifficultyLevel);
    const field = input.dataset.taskDifficultyField;
    const levels = normalizeTaskDifficultyLevels(gameSettings.taskDifficultyLevels);
    if (levels[index] && (field === "name" || field === "value")) {
      levels[index][field] = field === "value" ? Number(input.value) : input.value;
      gameSettings.taskDifficultyLevels = normalizeTaskDifficultyLevels(levels);
    }
  }
  recordEditorChange("settings", "game", input.id || input.dataset.taskDifficultyField || "change");
  saveEditorDraft(true);
  render();
}

export function handleStorageSettingsChange(input) {
  if (input.dataset.storageToken === "gitlab") {
    setGitlabToken(input.value.trim());
  } else if (input.dataset.storageField) {
    persistenceSettings[input.dataset.storageField] = input.value.trim();
    savePersistenceSettings();
  }
  renderEditor();
}
