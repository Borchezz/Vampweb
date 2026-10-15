import { editorState, runtime } from "./state.js";
import { dom } from "./dom.js";
import { renderActivityEditor, renderAgentEditor, renderEventEditor, renderLocationEditorContent, renderPathEditor, renderResourceEditor, renderStatusEditor, renderTraitEditor, renderUpgradeEditor, renderZoneEditor } from "./editor-entity-render.js";
import { renderMapBackgroundEditor } from "./editor-map-background-render.js";
import { renderStorageEditor } from "./editor-storage-render.js";
import { renderComponentEditor } from "./nighttime/component-editor.js";
import { renderClientEditor } from "./nighttime/client-editor.js";
import { getActiveEditorProfileId, getEditorHistoryState, isLocalDraftDirty } from "./persistence.js";
import { renderProfileBar } from "./editor-profile-bar.js";

export { locationOptions, renderCheckboxField, renderEntityPicker, renderSelectField, renderTextareaField, renderTextField, zoneOptions } from "./editor-fields.js";
export { renderActivityEditor, renderAgentEditor, renderEventEditor, renderLocationEditorContent, renderLocationTaskEditor, renderPathEditor, renderResourceEditor, renderStatusEditor, renderTaskEditorFields, renderTraitEditor, renderUpgradeEditor, renderZoneEditor } from "./editor-entity-render.js";
export { renderStorageEditor, renderStorageField, renderStorageSelect } from "./editor-storage-render.js";

export const editorTabs = [
  { id: "agents", label: "Агенты" },
  { id: "traits", label: "Черты" },
  { id: "upgrades", label: "Апгрейды" },
  { id: "events", label: "События" },
  { id: "statuses", label: "Статусные эффекты" },
  { id: "activities", label: "Активности" },
  { id: "map", label: "Карта" },
  { id: "zones", label: "Зоны" },
  { id: "paths", label: "Пути" },
  { id: "locations", label: "Локации" },
  { id: "resources", label: "Ресурсы" },
  { id: "storage", label: "Хранилище" },
  { id: "components", label: "Компоненты", phase: "nighttime" },
  { id: "clients", label: "Клиенты", phase: "nighttime" },
];

function getVisibleEditorTabs() {
  const mode = document.body.dataset.phaseMode || "full";
  return editorTabs.filter((tab) => mode === "full" || (mode === "nighttime" ? tab.phase === "nighttime" : tab.phase !== "nighttime"));
}

export function renderEditor() {
  const editing = runtime.appMode === "edit";
  const tabs = getVisibleEditorTabs();
  if (!tabs.some((tab) => tab.id === editorState.tab)) editorState.tab = tabs[0]?.id || "components";
  dom.editorProfileBar.innerHTML = editing ? renderEditorProfileBar() : "";
  dom.editorTabs.innerHTML = tabs
    .map(
      (tab) => `
        <button class="editor-tab ${editorState.tab === tab.id ? "active" : ""}" type="button" data-editor-tab="${tab.id}">
          ${tab.label}
        </button>
      `
    )
    .join("");

  dom.editorContent.innerHTML = editing ? renderEditorContent() : "";
}

export function renderEditorProfileBar() {
  const activeProfileId = getActiveEditorProfileId();
  const hasLocalDraft = isLocalDraftDirty(activeProfileId);
  const isPublished = String(runtime.persistenceStatus?.provider || "").startsWith("опубликовано:");
  const statusLabel = hasLocalDraft
    ? "Черновик не сохранён в workspace"
    : isPublished
      ? "Опубликовано в Git-снимок"
      : "Сохранено в workspace";
  const sourceLabel = hasLocalDraft
    ? "Автосохранено в браузере"
    : isPublished
      ? "Git-снимок обновлён"
      : runtime.persistenceStatus?.provider
        ? `Workspace: ${runtime.persistenceStatus.provider}`
        : "Workspace";
  const historyState = getEditorHistoryState();
  return renderProfileBar({ profiles: runtime.editorProfiles.profiles, activeProfileId, historyState, prefix: "editor", statusLabel, statusSource: sourceLabel });
}

export function renderEditorContent() {
  if (editorState.tab === "components") return renderComponentEditor();
  if (editorState.tab === "clients") return renderClientEditor(runtime.nighttimeClientEditorId || "");
  if (editorState.tab === "agents") return renderAgentEditor();
  if (editorState.tab === "traits") return renderTraitEditor();
  if (editorState.tab === "upgrades") return renderUpgradeEditor();
  if (editorState.tab === "events") return renderEventEditor();
  if (editorState.tab === "statuses") return renderStatusEditor();
  if (editorState.tab === "activities") return renderActivityEditor();
  if (editorState.tab === "map") return renderMapBackgroundEditor();
  if (editorState.tab === "zones") return renderZoneEditor();
  if (editorState.tab === "paths") return renderPathEditor();
  if (editorState.tab === "locations") return renderLocationEditorContent();
  if (editorState.tab === "storage") return renderStorageEditor();
  return renderResourceEditor();
}
