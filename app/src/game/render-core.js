import { state } from "./state.js";
import { renderEditor } from "./editor-render.js";
import { renderLog } from "./actions.js";
import { getVisibleLocations } from "./rules.js";
import { renderAgents, renderDaySummary, renderTopBar } from "./render-hud.js";
import { renderLocationPanel, renderRoutePlanner } from "./render-location.js";
import { renderMap } from "./render-map.js";
import { renderMode } from "./render-mode.js";
import { renderSettingsPanel } from "./render-settings.js";
import { renderUpgrades } from "./render-upgrades.js";
import { renderWeekendPanel } from "./render-weekend.js";
import { renderAgentProfile } from "./render-agent-profile.js";

export { renderAgents, renderDaySummary, renderTopBar } from "./render-hud.js";
export { TASK_ENERGY_MAX, TASK_ENERGY_MIN, renderLocationPanel, renderRoutePlanner } from "./render-location.js";
export { formatMoveCost, renderLandscapeLayer, renderMap, renderPathLayer } from "./render-map.js";
export { renderMode } from "./render-mode.js";
export { renderSelectOptions, renderSettingsPanel } from "./render-settings.js";
export { renderUpgrades } from "./render-upgrades.js";
export { renderWeekendPanel } from "./render-weekend.js";

export function render() {
  ensureSelection();
  renderMode();
  renderTopBar();
  renderAgents();
  renderAgentProfile();
  renderMap();
  renderRoutePlanner();
  renderLocationPanel();
  renderWeekendPanel();
  renderEditor();
  renderSettingsPanel();
  renderDaySummary();
  renderUpgrades();
  renderLog();
}

export function ensureSelection() {
  if (!getVisibleLocations().some((location) => location.id === state.selectedLocationId)) {
    state.selectedLocationId = getVisibleLocations()[0].id;
  }
}
