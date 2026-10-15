import {
  createEditorProfile,
  deleteEditorProfile,
  getActiveEditorProfile,
  getActiveEditorProfileId,
  loadEditorProfileConfig,
  overwriteEditorProfile,
  resetEditorHistory,
  switchEditorProfile,
} from "./persistence.js";
import { render } from "./render-core.js";
import { restartGame, showToast } from "./actions.js";

function promptProfileName(message, fallbackName = "") {
  const name = window.prompt(message, fallbackName);
  return name === null ? null : name.trim();
}

function offerRestart(profileName) {
  const shouldRestart = window.confirm(`Профиль «${profileName}» выбран. Перезапустить игру с данными этого профиля?`);
  if (shouldRestart) {
    restartGame();
    return;
  }
  render();
}

function getOverwritePanel(button) {
  return button.closest(".editor-profile-popover")?.querySelector("[data-editor-profile-overwrite-panel]") || null;
}

export async function handleEditorProfileSelect(select) {
  try {
    const result = await switchEditorProfile(select.value);
    if (!result) return;
    resetEditorHistory();
    offerRestart(result.profile.name);
  } catch (error) {
    showToast(error.message || "Не удалось переключить профиль.");
    render();
  }
}

export function handleEditorProfileAction(button) {
  const action = button.dataset.editorProfileAction;
  if (action === "create") {
    const name = promptProfileName("Название нового профиля", "Новый профиль");
    if (!name) return;
    try {
      const profile = createEditorProfile(name);
      showToast(`Профиль «${profile.name}» создан.`);
      resetEditorHistory();
      render();
    } catch (error) {
      showToast(error.message || "Не удалось создать профиль.");
    }
    return;
  }

  if (action === "duplicate") {
    const activeProfile = getActiveEditorProfile();
    const name = promptProfileName("Название копии профиля", `${activeProfile.name} копия`);
    if (!name) return;
    try {
      const profile = createEditorProfile(name);
      showToast(`Профиль «${profile.name}» создан как копия.`);
      resetEditorHistory();
      render();
    } catch (error) {
      showToast(error.message || "Не удалось дублировать профиль.");
    }
    return;
  }

  if (action === "show-overwrite") {
    const panel = getOverwritePanel(button);
    const targetSelect = panel?.querySelector("[data-editor-profile-overwrite-target]");
    if (!panel || !targetSelect?.value) {
      showToast("Нет другого профиля для перезаписи.");
      return;
    }
    panel.hidden = false;
    targetSelect.focus();
    return;
  }

  if (action === "cancel-overwrite") {
    const panel = getOverwritePanel(button);
    if (panel) panel.hidden = true;
    return;
  }

  if (action === "overwrite") {
    overwriteSelectedProfile(button);
    return;
  }

  if (action === "delete") {
    void deleteActiveEditorProfile();
  }
}

function overwriteSelectedProfile(button) {
  const panel = getOverwritePanel(button);
  const targetSelect = panel?.querySelector("[data-editor-profile-overwrite-target]");
  const targetProfileId = targetSelect?.value || "";
  const targetProfileName = targetSelect?.selectedOptions?.[0]?.textContent || targetProfileId;
  const sourceProfile = getActiveEditorProfile();

  if (!targetProfileId || !sourceProfile) {
    showToast("Выберите профиль для перезаписи.");
    return;
  }

  const confirmed = window.confirm(
    `Перезаписать профиль «${targetProfileName}» данными профиля «${sourceProfile.name}»? Текущие данные профиля «${targetProfileName}» будут заменены.`
  );
  if (!confirmed) return;

  try {
    const result = overwriteEditorProfile(targetProfileId);
    showToast(`Профиль «${result.target.name}» перезаписан данными профиля «${result.source.name}».`);
    render();
  } catch (error) {
    showToast(error.message || "Не удалось перезаписать профиль.");
    render();
  }
}

async function deleteActiveEditorProfile() {
  const activeProfile = getActiveEditorProfile();
  if (!activeProfile) return;
  if (!window.confirm(`Удалить профиль «${activeProfile.name}»?`)) return;

  try {
    const previousProfileId = getActiveEditorProfileId();
    const result = deleteEditorProfile(previousProfileId);
    if (!result) return;
    showToast(`Профиль «${result.deleted.name}» удалён.`);
    if (result.nextActiveProfileId !== previousProfileId) {
      await loadEditorProfileConfig(result.nextActiveProfileId);
      resetEditorHistory();
      offerRestart(getActiveEditorProfile().name);
      return;
    }
    render();
  } catch (error) {
    showToast(error.message || "Не удалось удалить профиль.");
    render();
  }
}
