import { persistenceSettings, runtime } from "./state.js";
import { getGitlabToken, isLocalDraftDirty } from "./persistence.js";
import { escapeAttribute, escapeHtml } from "./rules.js";

export function renderStorageField(field, label, value, options = {}) {
  const type = options.type || "text";
  return `
    <label class="editor-field ${options.wide ? "wide" : ""}">
      <span>${label}</span>
      <input type="${type}" value="${escapeAttribute(value ?? "")}" data-storage-field="${field}">
    </label>
  `;
}

export function renderStorageSelect(field, label, value, options) {
  return `
    <label class="editor-field">
      <span>${label}</span>
      <select data-storage-field="${field}">
        ${options
          .map((option) => `<option value="${option.value}" ${option.value === value ? "selected" : ""}>${option.label}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

export function renderStorageEditor() {
  const token = getGitlabToken();
  const draftState = isLocalDraftDirty() ? "есть несохранённые изменения" : "синхронизирован";
  return `
    <section class="editor-section">
      <h3>Серверное сохранение</h3>
      <p class="editor-note">
        Изменения в полях сразу сохраняются как локальный черновик в браузере.
        «Сохранить» записывает только активный профиль в рабочее хранилище вне Git.
        «Опубликовать» переносит активный профиль в data/editor/profiles; на GitLab Pages публикация создаёт commit через API.
      </p>
      <div class="editor-grid">
        ${renderStorageSelect("provider", "Режим", persistenceSettings.provider, [
          { value: "auto", label: "Авто" },
          { value: "local-api", label: "Локальный API" },
          { value: "gitlab", label: "GitLab" },
          { value: "browser", label: "Только браузер fallback" },
        ])}
        ${renderStorageField("localApiUrl", "Локальный API", persistenceSettings.localApiUrl)}
        ${renderStorageField("gitlabBaseUrl", "GitLab URL", persistenceSettings.gitlabBaseUrl)}
        ${renderStorageField("gitlabProjectId", "Project ID или путь", persistenceSettings.gitlabProjectId)}
        ${renderStorageField("gitlabBranch", "Ветка", persistenceSettings.gitlabBranch)}
        ${renderStorageField("gitlabFilePath", "Каталог данных", persistenceSettings.gitlabFilePath, { wide: true })}
        <label class="editor-field wide">
          <span>GitLab token</span>
          <input type="password" value="${escapeAttribute(token)}" data-storage-token="gitlab">
        </label>
      </div>
      <p class="editor-note">
        Текущий источник: ${escapeHtml(runtime.persistenceStatus.provider)}. Черновик: ${escapeHtml(draftState)}.
        ${escapeHtml(runtime.persistenceStatus.message)}
      </p>
    </section>
  `;
}
