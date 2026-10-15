import { DEFAULT_MAP_BACKGROUND_NAME, DEFAULT_MAP_BACKGROUND_SRC } from "./editor-config-format.js";
import { getActiveEditorProfile, getActiveEditorProfileMapBackground } from "./persistence.js";
import { escapeAttribute, escapeHtml } from "./rules.js";

function cssUrl(value) {
  return `url("${String(value || "").replace(/["\\\n\r]/g, "\\$&")}")`;
}

export function renderMapBackgroundEditor() {
  const activeProfile = getActiveEditorProfile();
  const background = getActiveEditorProfileMapBackground();
  const currentName = background?.name || DEFAULT_MAP_BACKGROUND_NAME;
  const currentSrc = background?.src || DEFAULT_MAP_BACKGROUND_SRC;
  const resetDisabled = background ? "" : "disabled";

  return `
    <section class="editor-section map-background-editor">
      <div class="editor-section-header">
        <h3>Карта</h3>
        <span class="editor-note">Профиль: ${escapeHtml(activeProfile?.name || "Дефолт")}</span>
      </div>
      <div class="map-background-preview" style="--map-background-preview-image: ${escapeAttribute(cssUrl(currentSrc))};" aria-hidden="true"></div>
      <div class="map-background-controls">
        <label class="editor-field map-background-file">
          <span>Фоновая карта</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-map-background-file>
        </label>
        <div class="map-background-meta">
          <span class="map-background-name">${escapeHtml(currentName)}</span>
          <span>${background ? "Пользовательская карта профиля" : "Стандартная карта"}</span>
        </div>
        <button class="secondary-button compact-button" type="button" data-map-background-action="reset" ${resetDisabled}>Сбросить</button>
      </div>
    </section>
  `;
}
