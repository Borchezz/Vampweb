import { runtime, state } from "./state.js";
import { redoEditorHistory, resetActiveEditorProfileDraft, undoEditorHistory } from "./persistence.js";
import { applyInitialConfigToState } from "./rules.js";
import { render } from "./render-core.js";
import { showToast } from "./actions.js";

function syncEditorRuntimeAfterHistoryChange() {
  applyInitialConfigToState(state);
  render();
}

function isNativeTextUndoTarget(target) {
  return Boolean(target?.matches?.("input:not([readonly]), textarea:not([readonly]), [contenteditable='true']"));
}

export function handleEditorUndo() {
  if (!undoEditorHistory()) {
    showToast("Нет действий для отмены.");
    return;
  }
  syncEditorRuntimeAfterHistoryChange();
  showToast("Действие отменено.");
}

export function handleEditorRedo() {
  if (!redoEditorHistory()) {
    showToast("Нет действий для повтора.");
    return;
  }
  syncEditorRuntimeAfterHistoryChange();
  showToast("Действие повторено.");
}

export async function handleEditorResetDraft() {
  const confirmed = window.confirm("Сбросить все несохранённые изменения текущего профиля и вернуться к последнему сохранённому состоянию?");
  if (!confirmed) return;

  try {
    const result = await resetActiveEditorProfileDraft();
    syncEditorRuntimeAfterHistoryChange();
    showToast(`Профиль «${result.profile?.name || "текущий"}» сброшен к последнему сохранённому состоянию.`);
  } catch (error) {
    showToast(error.message || "Не удалось сбросить изменения профиля.");
    render();
  }
}

export function handleEditorHistoryShortcut(event) {
  if (runtime.appMode !== "edit") return false;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || isNativeTextUndoTarget(event.target)) return false;

  const key = event.key.toLowerCase();
  if (key === "z" && event.shiftKey) {
    event.preventDefault();
    handleEditorRedo();
    return true;
  }
  if (key === "z") {
    event.preventDefault();
    handleEditorUndo();
    return true;
  }
  if (key === "y") {
    event.preventDefault();
    handleEditorRedo();
    return true;
  }

  return false;
}
