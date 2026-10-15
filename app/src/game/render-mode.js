import { editorState, runtime, state } from "./state.js";
import { dom } from "./dom.js";

export function renderMode() {
  const editing = runtime.appMode === "edit";
  const weekendActive = Boolean(state.weekend?.active) && !editing;
  const pathEditing = editing && runtime.pathEndpointEditMode && editorState.tab === "paths";
  document.body.classList.toggle("edit-mode", editing);
  document.body.classList.toggle("path-edit-mode", pathEditing);
  document.body.classList.toggle("weekend-mode", weekendActive);
  dom.modeToggleButton.innerHTML = editing
    ? `<span class="button-icon" aria-hidden="true">▶</span>Игра`
    : `<span class="button-icon" aria-hidden="true">✎</span>Редактор`;
  dom.editorPanel.classList.toggle("open", editing);
  dom.editorPanel.classList.toggle("collapsed", editorState.collapsed);
  dom.editorPanel.setAttribute("aria-hidden", String(!editing));
  dom.editorPanel.inert = !editing;
  dom.editorProfileBar.classList.toggle("open", editing);
  dom.editorProfileBar.setAttribute("aria-hidden", String(!editing));
  dom.editorProfileBar.inert = !editing;
  dom.collapseEditorButton.textContent = editorState.collapsed ? "Развернуть" : "Свернуть";
  dom.resetEditorDraftButton.disabled = !editing;
  dom.nextDayButton.disabled = editing || weekendActive;
  dom.restartButton.disabled = editing;
  dom.locationDetailsPanel.classList.toggle("open", state.locationPanelOpen && !editing && !weekendActive);
}
