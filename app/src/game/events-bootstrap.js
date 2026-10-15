import { editorState, runtime, state } from "./state.js";
import { dom } from "./dom.js";
import { loadEditorConfig, publishEditorConfig, resetEditorHistory, saveEditorConfig } from "./persistence.js";
import { applyInitialConfigToState } from "./rules.js";
import { render, renderMode, TASK_ENERGY_MAX, TASK_ENERGY_MIN } from "./render-core.js";
import { renderEditor } from "./editor-render.js";
import { registerDaytimeDebugCheats } from "./debug-daytime.js";
import { bindComponentEditorEvents } from "./nighttime/component-editor.js";
import { bindClientEditor } from "./nighttime/client-editor.js";
import { deleteClient } from "./nighttime/client-preferences.js";
import { handleLocationMechanicAction, handleLocationMechanicAdd, handleLocationMechanicFieldChange, handleLocationMechanicOfferFieldChange, handleLocationMechanicRemove, handleLocationMechanicThresholdFieldChange, handleLocationThresholdEffectFieldChange } from "./editor-location-mechanics-actions.js";
import { handleLocationVisibilityAdd, handleLocationVisibilityFieldChange, handleLocationVisibilityRemove } from "./editor-location-visibility-actions.js";
import { addLocationToRoute, addSelectedLocationToRoute, assignFavors, buyUpgrade, clearSelectedAgentRoute, convertReputationToSympathy, executeNextRouteStep, moveSelectedAgent, performTask, performWeekendActivity, removeRouteStop, renderLog, restartGame, setPublishButtonState, setRoutePlannerCollapsed, setRoutePlanning, setSaveButtonState, showToast, startNextDay, toggleLocationShop, tradeAtLocationShop } from "./actions.js";
import { ensurePlayMode, finishMapDrag, handleAddActivityEffect, handleAddAgentSympathyTrait, handleAddEventEffect, handleAddStatusEffect, handleAddTask, handleAddTaskEffect, handleAddTraitEffect, handleAddUpgradeEffect, handleActivityEffectFieldChange, handleAgentSympathyTraitFieldChange, handleAgentTraitsMenuToggle, handleAgentTraitToggle, handleEditorBack, handleEditorCancelCreateForm, handleEditorCreateEntity, handleEditorCreateFieldChange, handleEditorDeleteEntity, handleEditorFieldChange, handleEditorHistoryShortcut, handleEditorOpenCreateForm, handleEditorPickerChange, handleEditorProfileAction, handleEditorProfileSelect, handleEditorRedo, handleEditorResetDraft, handleEditorSelectEntity, handleEditorUndo, handleEventEffectFieldChange, handleGameSettingsChange, handleMainCharacterChange, handleMapBackgroundAction, handleMapBackgroundFileChange, handleMapPointerMove, handleRemoveActivityEffect, handleRemoveAgentSympathyTrait, handleRemoveEventEffect, handleRemoveStatusEffect, handleRemoveTaskEffect, handleRemoveTraitEffect, handleRemoveUpgradeEffect, handleSettingsTabChange, handleStatusEffectFieldChange, handleStorageSettingsChange, handleTaskEffectFieldChange, handleTraitEffectFieldChange, handleUpgradeCostResourceChange, handleUpgradeEffectFieldChange, handleZoneLabelDragMode, setAppMode, setBarPanelOpen, setInventoryPanelOpen, setJournalPanelOpen, setSettingsPanelOpen, setUpgradeMenuOpen, startMapDrag } from "./editor-actions.js";

function clampTaskEnergy(value, maxEnergy = TASK_ENERGY_MAX) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return TASK_ENERGY_MIN;
  return Math.min(maxEnergy, Math.max(TASK_ENERGY_MIN, Math.trunc(numericValue)));
}

function getAffordableTaskEnergies(control) {
  return (control?.dataset.affordableEnergyValues || "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
}

function getMaxAffordableTaskEnergy(control) {
  return getAffordableTaskEnergies(control).at(-1) || TASK_ENERGY_MIN;
}

function getAdjacentAffordableTaskEnergy(control, currentEnergy, step) {
  const affordableEnergies = getAffordableTaskEnergies(control);
  if (!affordableEnergies.length) return currentEnergy;
  if (step > 0) return affordableEnergies.find((energy) => energy > currentEnergy) ?? currentEnergy;
  return affordableEnergies.filter((energy) => energy < currentEnergy).at(-1) ?? currentEnergy;
}

function getTaskEnergyPreview(control, energy) {
  try {
    return JSON.parse(control?.dataset.taskEnergyPreviews || "{}")[String(energy)] || null;
  } catch {
    return null;
  }
}

function clampTooltipCoordinate(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function bindGlobalTooltips() {
  const tooltip = dom.globalTooltip;
  if (!tooltip) return;
  let activeTarget = null;

  document.querySelectorAll("[title]").forEach((target) => {
    const text = target.getAttribute("title");
    if (!text || target.dataset.tooltip) return;
    target.dataset.tooltip = text;
    target.removeAttribute("title");
  });

  function positionTooltip(target) {
    const padding = 12;
    const gap = 8;
    const targetRect = target.getBoundingClientRect();
    const availableWidth = window.innerWidth - padding * 2;
    const availableHeight = window.innerHeight - padding * 2;
    tooltip.style.maxWidth = `${availableWidth}px`;
    tooltip.style.maxHeight = `${availableHeight}px`;
    const tooltipRect = tooltip.getBoundingClientRect();
    const left = clampTooltipCoordinate(targetRect.left + targetRect.width / 2 - tooltipRect.width / 2, padding, window.innerWidth - padding - tooltipRect.width);
    const below = targetRect.bottom + gap;
    const top = below + tooltipRect.height <= window.innerHeight - padding ? below : Math.max(padding, targetRect.top - gap - tooltipRect.height);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showTooltip(target) {
    const text = target?.dataset.tooltip || target?.getAttribute("title");
    if (!text) return;
    target.dataset.tooltip = text;
    target.removeAttribute("title");
    activeTarget = target;
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(target);
  }

  function hideTooltip(target) {
    if (target && target !== activeTarget) return;
    activeTarget = null;
    tooltip.hidden = true;
  }

  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-tooltip], [title]");
    if (target && target !== activeTarget) showTooltip(target);
  });
  document.addEventListener("pointerout", (event) => {
    if (!activeTarget || activeTarget.contains(event.relatedTarget)) return;
    hideTooltip(activeTarget);
  });
  document.addEventListener("focusin", (event) => showTooltip(event.target.closest?.("[data-tooltip], [title]")));
  document.addEventListener("focusout", (event) => {
    if (!activeTarget || activeTarget.contains(event.relatedTarget)) return;
    hideTooltip(activeTarget);
  });
  window.addEventListener("resize", () => {
    if (activeTarget) positionTooltip(activeTarget);
  });
  window.addEventListener("scroll", () => {
    if (activeTarget) positionTooltip(activeTarget);
  }, true);
}

function syncTaskEnergyHint(control, energy) {
  const hint = control?.querySelector("[data-task-energy-hint]");
  const preview = getTaskEnergyPreview(control, energy);
  const overtime = Boolean(preview?.overtime > 0);
  const tooltip = overtime ? preview.hint : "";
  const overtimeTargets = [
    control?.querySelector("[data-task-energy-input]"),
    control?.querySelector('[data-task-energy-step="1"]'),
  ].filter(Boolean);

  overtimeTargets.forEach((target) => {
    target.classList.toggle("overtime", overtime);
    if (tooltip) target.dataset.tooltip = tooltip;
    else delete target.dataset.tooltip;
  });

  if (!hint) return;
  hint.textContent = overtime ? "" : preview?.hint || "";
  hint.classList.toggle("blocked", Boolean(preview && !preview.can));
}

function syncTaskSuccessChance(control, energy) {
  const chance = control?.querySelector("[data-task-success-chance]");
  if (!chance) return;
  try {
    const values = JSON.parse(control.dataset.taskSuccessChances || "{}");
    const usesTemporaryAdvantage = control.querySelector("[data-task-temporary-advantage]")?.getAttribute("aria-pressed") === "true";
    const value = values[String(energy)]?.[usesTemporaryAdvantage ? "advantage" : "standard"];
    chance.textContent = `${Number.isFinite(value) ? value : 0}%`;
  } catch {
    chance.textContent = "0%";
  }
}

function syncTaskEnergyControl(control, commit = true) {
  const input = control?.querySelector("[data-task-energy-input]");
  if (!input) return TASK_ENERGY_MIN;

  const rawValue = input.value.trim();
  const shouldCommit = commit || rawValue !== "";
  const maxAffordableEnergy = getMaxAffordableTaskEnergy(control);
  const energy = shouldCommit ? clampTaskEnergy(rawValue, commit ? maxAffordableEnergy : TASK_ENERGY_MAX) : null;

  if (energy !== null && input.value !== String(energy)) {
    input.value = String(energy);
  }
  if (commit) input.max = String(maxAffordableEnergy);

  const affordableEnergies = getAffordableTaskEnergies(control);
  const canUseSelectedEnergy = !input.disabled && energy !== null && affordableEnergies.includes(energy);
  const decreaseButton = control.querySelector('[data-task-energy-step="-1"]');
  const increaseButton = control.querySelector('[data-task-energy-step="1"]');
  const rollButton = control.querySelector("[data-use-selected-energy]");
  const canIncrease = energy !== null && affordableEnergies.some((affordableEnergy) => affordableEnergy > energy);

  if (decreaseButton) decreaseButton.disabled = input.disabled || energy === null || energy <= TASK_ENERGY_MIN;
  if (increaseButton) increaseButton.disabled = input.disabled || !canIncrease;
  if (rollButton) rollButton.disabled = !canUseSelectedEnergy;
  if (energy !== null) {
    syncTaskEnergyHint(control, energy);
    syncTaskSuccessChance(control, energy);
  }

  return energy ?? TASK_ENERGY_MIN;
}

export function bindEvents() {
  let resizeFrame = 0;
  bindGlobalTooltips();
  bindComponentEditorEvents();
  bindClientEditor();
  window.addEventListener("nighttime-clients-changed", () => {
    if (editorState.tab === "clients") render();
  });

  dom.agentList.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-agent-select]");
    if (!selectButton) return;
    if (event.detail === 2) {
      runtime.agentProfileAgentId = selectButton.dataset.agentSelect;
      render();
      return;
    }
    if (runtime.appMode === "edit") {
      editorState.tab = "agents";
      editorState.agentId = selectButton.dataset.agentSelect;
      editorState.entityViews.agents = "edit";
    }
    state.selectedAgentId = selectButton.dataset.agentSelect;
    if (runtime.agentProfileAgentId) runtime.agentProfileAgentId = selectButton.dataset.agentSelect;
    render();
  });

  dom.closeAgentProfileButton.addEventListener("click", () => {
    runtime.agentProfileAgentId = "";
    render();
  });

  dom.cityMap.addEventListener("pointerdown", startMapDrag);
  window.addEventListener("pointermove", handleMapPointerMove);
  window.addEventListener("pointerup", finishMapDrag);
  window.addEventListener("pointercancel", finishMapDrag);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && runtime.agentProfileAgentId) {
      runtime.agentProfileAgentId = "";
      render();
      return;
    }
    handleEditorHistoryShortcut(event);
  });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });

  dom.cityMap.addEventListener("click", (event) => {
    if (runtime.suppressMapClick) {
      event.preventDefault();
      return;
    }
    const locationButton = event.target.closest("[data-location-id]");
    if (!locationButton) return;
    if (state.weekend?.active && runtime.appMode !== "edit") return;
    if (runtime.appMode === "edit") {
      editorState.tab = "locations";
      editorState.locationId = locationButton.dataset.locationId;
      editorState.taskLocationId = locationButton.dataset.locationId;
      editorState.taskId = "";
      editorState.entityViews.locations = "location";
      render();
      return;
    }
    if (state.routePlanner.planning) {
      state.locationPanelOpen = false;
      addLocationToRoute(locationButton.dataset.locationId);
      return;
    }
    state.selectedLocationId = locationButton.dataset.locationId;
    state.locationPanelOpen = true;
    render();
  });

  dom.modeToggleButton.addEventListener("click", () => {
    setAppMode(runtime.appMode === "edit" ? "play" : "edit");
  });

  dom.settingsToggleButton.addEventListener("click", () => {
    setSettingsPanelOpen(!runtime.settingsPanelOpen);
  });

  dom.inventoryToggleButton.addEventListener("click", () => {
    setInventoryPanelOpen(!runtime.inventoryPanelOpen);
  });

  dom.closeInventoryButton.addEventListener("click", () => {
    setInventoryPanelOpen(false);
  });

  dom.journalToggleButton.addEventListener("click", () => {
    setJournalPanelOpen(!runtime.journalPanelOpen);
  });

  dom.closeJournalButton.addEventListener("click", () => {
    setJournalPanelOpen(false);
  });

  dom.barToggleButton.addEventListener("click", () => {
    setBarPanelOpen(!runtime.barPanelOpen);
  });

  dom.closeBarButton.addEventListener("click", () => {
    setBarPanelOpen(false);
  });

  dom.closeSettingsButton.addEventListener("click", () => {
    setSettingsPanelOpen(false);
  });

  dom.locationMechanics.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-location-shop-toggle]");
    if (toggle) {
      toggleLocationShop(toggle.dataset.locationShopToggle, Number(toggle.dataset.locationShopIndex));
      return;
    }
    const trade = event.target.closest("[data-location-shop-trade]");
    if (trade) {
      tradeAtLocationShop(trade.dataset.locationShopLocation, Number(trade.dataset.locationShopIndex), Number(trade.dataset.locationShopOffer), trade.dataset.locationShopTrade);
    }
  });

  dom.settingsPanel.addEventListener("change", (event) => {
    const input = event.target.closest(
      '#taskMechanicSelect, #baseDieSelect, #advantageDieSelect, #taskDifficultyCountInput, [data-task-difficulty-level], #mainCharacterSympathyInput, input[name="interfaceTheme"], #sympathyMinInput, #sympathyStartInput, #sympathyMaxInput, #sympathySectionsInput'
    );
    if (input) handleGameSettingsChange(input);
  });

  dom.settingsPanel.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-settings-tab]");
    if (tabButton) handleSettingsTabChange(tabButton);
  });

  dom.editorTabs.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-editor-tab]");
    if (!tabButton) return;
    editorState.tab = tabButton.dataset.editorTab;
    if (editorState.tab !== "zones" && editorState.entityViews[editorState.tab]) editorState.entityViews[editorState.tab] = "list";
    if (editorState.tab !== "paths") runtime.pathEndpointEditMode = false;
    if (editorState.tab !== "zones") runtime.zoneLabelDragZoneId = "";
    render();
  });

  dom.editorProfileBar.addEventListener("change", (event) => {
    const profileSelect = event.target.closest("[data-editor-profile-select]");
    if (profileSelect) void handleEditorProfileSelect(profileSelect);
  });

  dom.editorProfileBar.addEventListener("click", (event) => {
    const historyAction = event.target.closest("[data-editor-history-action]");
    if (historyAction?.dataset.editorHistoryAction === "undo") {
      handleEditorUndo();
      return;
    }
    if (historyAction?.dataset.editorHistoryAction === "redo") {
      handleEditorRedo();
      return;
    }

    const profileAction = event.target.closest("[data-editor-profile-action]");
    if (profileAction) handleEditorProfileAction(profileAction);
  });

  dom.editorContent.addEventListener("change", (event) => {
    const locationVisibilityField = event.target.closest("[data-location-visibility-field]");
    if (locationVisibilityField) {
      handleLocationVisibilityFieldChange(locationVisibilityField);
      return;
    }
    const clientPicker = event.target.closest("[data-client-picker]");
    if (clientPicker) {
      runtime.nighttimeClientEditorId = clientPicker.value;
      render();
      return;
    }
    const locationCounterField = event.target.closest("[data-location-counter-field]");
    if (locationCounterField) {
      handleLocationMechanicFieldChange(locationCounterField);
      return;
    }
    const locationMechanicField = event.target.closest("[data-location-mechanic-field]");
    if (locationMechanicField) {
      handleLocationMechanicFieldChange(locationMechanicField);
      return;
    }
    const locationThresholdEffect = event.target.closest("[data-location-threshold-effect-field]");
    if (locationThresholdEffect) {
      handleLocationThresholdEffectFieldChange(locationThresholdEffect);
      return;
    }
    const locationMechanicThreshold = event.target.closest("[data-location-mechanic-threshold-field]");
    if (locationMechanicThreshold) {
      handleLocationMechanicThresholdFieldChange(locationMechanicThreshold);
      return;
    }
    const locationMechanicOffer = event.target.closest("[data-location-mechanic-offer-field]");
    if (locationMechanicOffer) {
      handleLocationMechanicOfferFieldChange(locationMechanicOffer);
      return;
    }
    const mapBackgroundInput = event.target.closest("[data-map-background-file]");
    if (mapBackgroundInput) {
      void handleMapBackgroundFileChange(mapBackgroundInput);
      return;
    }

    const storageInput = event.target.closest("[data-storage-field], [data-storage-token]");
    if (storageInput) {
      handleStorageSettingsChange(storageInput);
      return;
    }
    const createField = event.target.closest("[data-editor-create-scope]");
    if (createField) {
      handleEditorCreateFieldChange(createField);
      return;
    }
    const upgradeCostField = event.target.closest("[data-upgrade-cost-resource]");
    if (upgradeCostField) {
      handleUpgradeCostResourceChange(upgradeCostField);
      return;
    }
    const picker = event.target.closest("[data-editor-picker]");
    if (picker) {
      handleEditorPickerChange(picker);
      return;
    }
    const mainCharacterSelect = event.target.closest("[data-main-character-select]");
    if (mainCharacterSelect) {
      handleMainCharacterChange(mainCharacterSelect);
      return;
    }
    const agentTraitToggle = event.target.closest("[data-agent-trait-toggle]");
    if (agentTraitToggle) {
      handleAgentTraitToggle(agentTraitToggle);
      return;
    }
    const agentSympathyTraitField = event.target.closest("[data-agent-sympathy-trait-field]");
    if (agentSympathyTraitField) {
      handleAgentSympathyTraitFieldChange(agentSympathyTraitField);
      return;
    }
    const traitEffectField = event.target.closest("[data-trait-effect-field]");
    if (traitEffectField) {
      handleTraitEffectFieldChange(traitEffectField);
      return;
    }
    const upgradeEffectField = event.target.closest("[data-upgrade-effect-field]");
    if (upgradeEffectField) {
      handleUpgradeEffectFieldChange(upgradeEffectField);
      return;
    }
    const eventEffectField = event.target.closest("[data-event-effect-field]");
    if (eventEffectField) {
      handleEventEffectFieldChange(eventEffectField);
      return;
    }
    const activityEffectField = event.target.closest("[data-activity-effect-field]");
    if (activityEffectField) {
      handleActivityEffectFieldChange(activityEffectField);
      return;
    }
    const statusEffectField = event.target.closest("[data-status-effect-field]");
    if (statusEffectField) {
      handleStatusEffectFieldChange(statusEffectField);
      return;
    }
    const taskEffectField = event.target.closest("[data-task-effect-field]");
    if (taskEffectField) {
      handleTaskEffectFieldChange(taskEffectField);
      return;
    }
    const field = event.target.closest("[data-edit-scope]");
    if (field) handleEditorFieldChange(field);
  });

  dom.editorContent.addEventListener("click", (event) => {
    const clientOpen = event.target.closest("[data-client-open]");
    if (clientOpen) {
      runtime.nighttimeClientEditorId = clientOpen.dataset.clientOpen;
      render();
      return;
    }
    const clientStep = event.target.closest("[data-client-select]");
    if (clientStep?.dataset.clientSelect) {
      runtime.nighttimeClientEditorId = clientStep.dataset.clientSelect;
      render();
      return;
    }
    if (event.target.closest("[data-client-back]")) {
      runtime.nighttimeClientEditorId = "";
      render();
      return;
    }
    if (event.target.closest("[data-client-delete]")) {
      deleteClient(runtime.nighttimeClientEditorId);
      runtime.nighttimeClientEditorId = "";
      render();
      return;
    }
    const addLocationCounterButton = event.target.closest("[data-location-mechanic-add]");
    if (addLocationCounterButton) {
      handleLocationMechanicAdd(addLocationCounterButton);
      return;
    }
    const addLocationVisibilityButton = event.target.closest("[data-location-visibility-add]");
    if (addLocationVisibilityButton) {
      handleLocationVisibilityAdd(addLocationVisibilityButton);
      return;
    }
    const removeLocationVisibilityButton = event.target.closest("[data-location-visibility-remove]");
    if (removeLocationVisibilityButton) {
      handleLocationVisibilityRemove(removeLocationVisibilityButton);
      return;
    }
    const removeLocationCounterButton = event.target.closest("[data-location-mechanic-remove]");
    if (removeLocationCounterButton) {
      handleLocationMechanicRemove(removeLocationCounterButton);
      return;
    }
    const locationMechanicAction = event.target.closest("[data-location-mechanic-action]");
    if (locationMechanicAction) {
      handleLocationMechanicAction(locationMechanicAction);
      return;
    }
    const entitySelectButton = event.target.closest("[data-editor-select-entity]");
    if (entitySelectButton) {
      handleEditorSelectEntity(entitySelectButton);
      return;
    }

    const backButton = event.target.closest("[data-editor-back]");
    if (backButton) {
      handleEditorBack(backButton);
      return;
    }

    const mapBackgroundAction = event.target.closest("[data-map-background-action]");
    if (mapBackgroundAction) {
      handleMapBackgroundAction(mapBackgroundAction);
      return;
    }

    const openCreateButton = event.target.closest("[data-editor-open-create]");
    if (openCreateButton) {
      handleEditorOpenCreateForm(openCreateButton);
      return;
    }

    const createButton = event.target.closest("[data-editor-create-entity]");
    if (createButton) {
      handleEditorCreateEntity(createButton);
      return;
    }

    const cancelCreateButton = event.target.closest("[data-editor-cancel-create]");
    if (cancelCreateButton) {
      handleEditorCancelCreateForm(cancelCreateButton);
      return;
    }

    const deleteButton = event.target.closest("[data-editor-delete-entity]");
    if (deleteButton) {
      handleEditorDeleteEntity(deleteButton);
      return;
    }

    const pathEditButton = event.target.closest("[data-path-endpoint-edit-toggle]");
    if (pathEditButton) {
      runtime.pathEndpointEditMode = !runtime.pathEndpointEditMode;
      if (runtime.pathEndpointEditMode) runtime.zoneLabelDragZoneId = "";
      render();
      return;
    }

    const zoneLabelDragButton = event.target.closest("[data-zone-label-drag-mode]");
    if (zoneLabelDragButton) {
      handleZoneLabelDragMode(zoneLabelDragButton);
      return;
    }

    const agentTraitsMenuButton = event.target.closest("[data-agent-traits-menu-toggle]");
    if (agentTraitsMenuButton) {
      handleAgentTraitsMenuToggle(agentTraitsMenuButton);
      return;
    }

    const addSympathyTraitButton = event.target.closest("[data-agent-sympathy-trait-add]");
    if (addSympathyTraitButton) {
      handleAddAgentSympathyTrait(addSympathyTraitButton);
      return;
    }

    const removeSympathyTraitButton = event.target.closest("[data-agent-sympathy-trait-remove]");
    if (removeSympathyTraitButton) {
      handleRemoveAgentSympathyTrait(removeSympathyTraitButton);
      return;
    }

    const addTraitEffectButton = event.target.closest("[data-trait-effect-add]");
    if (addTraitEffectButton) {
      handleAddTraitEffect(addTraitEffectButton);
      return;
    }

    const removeTraitEffectButton = event.target.closest("[data-trait-effect-remove]");
    if (removeTraitEffectButton) {
      handleRemoveTraitEffect(removeTraitEffectButton);
      return;
    }

    const addUpgradeEffectButton = event.target.closest("[data-upgrade-effect-add]");
    if (addUpgradeEffectButton) {
      handleAddUpgradeEffect(addUpgradeEffectButton);
      return;
    }

    const removeUpgradeEffectButton = event.target.closest("[data-upgrade-effect-remove]");
    if (removeUpgradeEffectButton) {
      handleRemoveUpgradeEffect(removeUpgradeEffectButton);
      return;
    }

    const addEventEffectButton = event.target.closest("[data-event-effect-add]");
    if (addEventEffectButton) {
      handleAddEventEffect(addEventEffectButton);
      return;
    }

    const removeEventEffectButton = event.target.closest("[data-event-effect-remove]");
    if (removeEventEffectButton) {
      handleRemoveEventEffect(removeEventEffectButton);
      return;
    }

    const addActivityEffectButton = event.target.closest("[data-activity-effect-add]");
    if (addActivityEffectButton) {
      handleAddActivityEffect(addActivityEffectButton);
      return;
    }

    const removeActivityEffectButton = event.target.closest("[data-activity-effect-remove]");
    if (removeActivityEffectButton) {
      handleRemoveActivityEffect(removeActivityEffectButton);
      return;
    }

    const addStatusEffectButton = event.target.closest("[data-status-effect-add]");
    if (addStatusEffectButton) {
      handleAddStatusEffect(addStatusEffectButton);
      return;
    }

    const removeStatusEffectButton = event.target.closest("[data-status-effect-remove]");
    if (removeStatusEffectButton) {
      handleRemoveStatusEffect(removeStatusEffectButton);
      return;
    }

    const addTaskEffectButton = event.target.closest("[data-task-effect-add]");
    if (addTaskEffectButton) {
      handleAddTaskEffect(addTaskEffectButton);
      return;
    }

    const removeTaskEffectButton = event.target.closest("[data-task-effect-remove]");
    if (removeTaskEffectButton) {
      handleRemoveTaskEffect(removeTaskEffectButton);
      return;
    }

    const addTaskButton = event.target.closest("[data-editor-add-task]");
    if (addTaskButton) handleAddTask(addTaskButton);
  });

  dom.saveEditorButton.addEventListener("click", async () => {
    setSaveButtonState("saving");
    try {
      const provider = await saveEditorConfig({ showToast: true });
      setSaveButtonState(provider ? "saved" : "error");
    } catch (error) {
      setSaveButtonState("error");
      showToast(`Не удалось сохранить профиль: ${error.message || error}`);
    } finally {
      renderEditor();
    }
  });

  dom.publishEditorButton.addEventListener("click", async () => {
    setPublishButtonState("publishing");
    try {
      const provider = await publishEditorConfig({ showToast: true });
      setPublishButtonState(provider ? "published" : "error");
    } catch (error) {
      setPublishButtonState("error");
      showToast(`Не удалось опубликовать профиль: ${error.message || error}`);
    } finally {
      renderEditor();
    }
  });

  dom.resetEditorDraftButton.addEventListener("click", () => {
    void handleEditorResetDraft();
  });

  dom.collapseEditorButton.addEventListener("click", () => {
    editorState.collapsed = !editorState.collapsed;
    renderMode();
  });

  dom.moveButton.addEventListener("click", () => {
    if (ensurePlayMode()) moveSelectedAgent();
  });
  dom.routePlanner.addEventListener("click", (event) => {
    const collapseToggle = event.target.closest("[data-route-collapse-toggle]");
    if (collapseToggle) {
      if (ensurePlayMode()) setRoutePlannerCollapsed(!state.routePlanner.collapsed);
      return;
    }

    const planningToggle = event.target.closest("[data-route-planning-toggle]");
    if (planningToggle) {
      if (ensurePlayMode()) setRoutePlanning(!state.routePlanner.planning);
      return;
    }

    const addButton = event.target.closest("[data-route-add]");
    if (addButton) {
      if (ensurePlayMode()) addSelectedLocationToRoute();
      return;
    }

    const stepButton = event.target.closest("[data-route-step]");
    if (stepButton) {
      if (ensurePlayMode()) executeNextRouteStep();
      return;
    }

    const clearButton = event.target.closest("[data-route-clear]");
    if (clearButton) {
      if (ensurePlayMode()) clearSelectedAgentRoute();
      return;
    }

    const removeButton = event.target.closest("[data-route-remove]");
    if (removeButton) {
      if (ensurePlayMode()) removeRouteStop(Number(removeButton.dataset.routeRemove));
    }
  });
  dom.closeLocationPanelButton.addEventListener("click", () => {
    state.locationPanelOpen = false;
    state.openLocationShopId = "";
    render();
  });

  dom.weekendActivityList.addEventListener("click", (event) => {
    const activityButton = event.target.closest("[data-weekend-activity-id]");
    if (!activityButton || !ensurePlayMode()) return;
    const card = activityButton.closest(".weekend-activity-card");
    const partnerId = card?.querySelector("[data-weekend-partner-id]")?.value || "";
    performWeekendActivity(activityButton.dataset.weekendActivityId, partnerId);
  });

  dom.taskStack.addEventListener("click", (event) => {
    const stepButton = event.target.closest("[data-task-energy-step]");
    if (stepButton) {
      const control = stepButton.closest("[data-task-energy-control]");
      const input = control?.querySelector("[data-task-energy-input]");
      if (!input || input.disabled) return;

      const currentEnergy = syncTaskEnergyControl(control);
      const nextEnergy = getAdjacentAffordableTaskEnergy(control, currentEnergy, Number(stepButton.dataset.taskEnergyStep || 0));
      input.value = String(nextEnergy);
      syncTaskEnergyControl(control);
      return;
    }

    const advantageButton = event.target.closest("[data-task-temporary-advantage]");
    if (advantageButton) {
      const control = advantageButton.closest("[data-task-energy-control]");
      const active = advantageButton.getAttribute("aria-pressed") === "true";
      advantageButton.setAttribute("aria-pressed", String(!active));
      advantageButton.classList.toggle("active", !active);
      syncTaskEnergyControl(control, false);
      return;
    }

    const button = event.target.closest("[data-task-id]");
    if (!button) return;
    if (!ensurePlayMode()) return;
    const card = button.closest(".task-card");
    const energyInput = card?.querySelector("[data-task-energy-input]");
    const energy = button.dataset.useSelectedEnergy ? syncTaskEnergyControl(energyInput?.closest("[data-task-energy-control]")) : Number(button.dataset.energy || 1);
    const useTemporaryAdvantage = card?.querySelector("[data-task-temporary-advantage]")?.getAttribute("aria-pressed") === "true";
    performTask(button.dataset.taskId, energy, useTemporaryAdvantage);
  });

  dom.taskStack.addEventListener("input", (event) => {
    const input = event.target.closest("[data-task-energy-input]");
    if (!input) return;
    syncTaskEnergyControl(input.closest("[data-task-energy-control]"), false);
  });

  dom.taskStack.addEventListener("change", (event) => {
    const input = event.target.closest("[data-task-energy-input]");
    if (!input) return;
    syncTaskEnergyControl(input.closest("[data-task-energy-control]"));
  });

  dom.upgradeList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upgrade-id]");
    if (!button) return;
    if (!ensurePlayMode()) return;
    buyUpgrade(button.dataset.upgradeId);
  });

  dom.upgradeToggleButton.addEventListener("click", () => {
    if (ensurePlayMode()) setUpgradeMenuOpen(!runtime.upgradePanelOpen);
  });
  dom.closeUpgradesButton.addEventListener("click", () => setUpgradeMenuOpen(false));

  dom.repToSympathyButton.addEventListener("click", () => {
    if (ensurePlayMode()) convertReputationToSympathy();
  });
  dom.restartButton.addEventListener("click", () => {
    if (ensurePlayMode()) restartGame();
  });
  dom.nextDayButton.addEventListener("click", () => {
    if (ensurePlayMode()) startNextDay();
  });

  dom.clearLogButton.addEventListener("click", () => {
    state.log = [];
    renderLog();
  });
}

export async function bootstrap() {
  await loadEditorConfig();
  resetEditorHistory();
  applyInitialConfigToState(state);
  assignFavors();
  bindEvents();
  registerDaytimeDebugCheats();
  render();
}
