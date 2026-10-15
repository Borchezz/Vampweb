import { EDITOR_CONFIG_STORAGE_KEY, EDITOR_DRAFT_DIRTY_STORAGE_KEY, EDITOR_MODE_PHASE_STORAGE_KEY, EDITOR_MODE_STORAGE_KEY, EDITOR_PROFILE_DELETED_STORAGE_KEY, EDITOR_PROFILE_INDEX_STORAGE_KEY, EDITOR_SAVED_CONFIG_STORAGE_KEY, gameSettings, GITLAB_TOKEN_STORAGE_KEY, PERSISTENCE_SETTINGS_STORAGE_KEY, persistenceSettings, resourceDefs, runtime, statDefs } from "./state.js";
import { activities, eventDeck, locations, paths, statusEffects, tasks, traitCatalog, upgrades, zones } from "./data.js";
import { clearEditorChangeSummary, getEditorChangeSummary } from "./rules.js";
import { showSaveToast, showToast } from "./actions.js";
import { deepClone } from "./utils.js";
import { DEFAULT_EDITOR_PROFILE_ID, EDITOR_CONFIG_MANIFEST_FILE, EDITOR_CONFIG_VERSION, EDITOR_CONFIG_COLLECTIONS, EDITOR_PROFILE_FORMAT, EDITOR_PROFILE_INDEX_VERSION, createEditorProfileIndex, getEditorConfigDirFromPath, getEditorConfigFileEntries, getEditorConfigFilePath, getEditorConfigManifestPath, getEditorProfileDirPath, getEditorProfileIndexPath, normalizeEditorProfileId, normalizeEditorProfileIndex, normalizeMapBackground, composeEditorConfig, isStoredConfig } from "./editor-config-format.js";
import { collectEditorProfileSavePayloadErrors } from "./editor-profile-schema.js";
import { createTaskFromConfig as createNormalizedTaskFromConfig } from "./content-normalize.js";
import { normalizeAgentBlueprint } from "./agent-runtime.js";
import { applyEditorRuntimePatch, buildEditorRuntimePatch } from "./editor-runtime-hydration.js";
import { serializeLocation } from "./location-contract.js";
import { stabilizeTaskLocationEffectLists } from "./task-effect-registry.js";
import { serializeTrait } from "./trait-catalog.js";
import { serializeTask } from "./task-contract.js";
import { serializeUpgrade } from "./upgrade-contract.js";
import { serializeEvent } from "./event-contract.js";
import { serializeActivity } from "./activity-contract.js";
import { serializeStatus } from "./status-contract.js";
import { getPhaseMode } from "./phase-mode.js";
import { migrateEditorConfig } from "./editor-config-migrations.js";

export { composeEditorConfig, getEditorConfigDirFromPath, getEditorConfigFileEntries, getEditorConfigManifestPath, getEditorProfileIndexPath, getEditorProfileManifestPath, isStoredConfig } from "./editor-config-format.js";
export { applySavedTaskFields, hasOwnConfigField } from "./content-normalize.js";

const EDITOR_HISTORY_LIMIT = 10;
const LOCAL_API_REQUEST_TIMEOUT_MS = 15_000;
const PUBLISH_REQUEST_TIMEOUT_MS = 55_000;

async function fetchWithTimeout(url, options, { timeoutMs, operation }) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Истекло время ожидания (${Math.round(timeoutMs / 1000)} с): ${operation}. Проверьте соединение с локальным сервером и Git.`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function getApiResponseError(response, operation) {
  let details = "";
  try {
    const body = await response.json();
    details = String(body?.error || body?.message || "").trim();
  } catch {
    // Some old local servers reply with plain text; the status is still useful.
  }
  return `${operation} вернул ${response.status}${details ? `: ${details}` : ""}`;
}

export function savePersistenceSettings() {
  try {
    localStorage.setItem(PERSISTENCE_SETTINGS_STORAGE_KEY, JSON.stringify(persistenceSettings));
  } catch {
    showToast("Не удалось сохранить настройки хранилища.");
  }
}

export function getGitlabToken() {
  try {
    return localStorage.getItem(GITLAB_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setGitlabToken(token) {
  try {
    if (token) localStorage.setItem(GITLAB_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(GITLAB_TOKEN_STORAGE_KEY);
  } catch {
    showToast("Не удалось сохранить GitLab token.");
  }
}

export function hasGitlabSettings() {
  return Boolean(
    persistenceSettings.gitlabBaseUrl &&
      persistenceSettings.gitlabProjectId &&
      persistenceSettings.gitlabBranch &&
      persistenceSettings.gitlabFilePath &&
      getGitlabToken()
  );
}

export function getWorkspaceSaveAttempts() {
  if (persistenceSettings.provider === "local-api") return ["local-api"];
  if (persistenceSettings.provider === "gitlab" || persistenceSettings.provider === "browser") return ["browser"];
  return ["local-api", "browser"];
}

export function getPublishAttempts() {
  if (persistenceSettings.provider === "local-api") return ["local-api"];
  if (persistenceSettings.provider === "gitlab") return ["gitlab"];
  if (persistenceSettings.provider === "browser") return [];
  return ["local-api", "gitlab"];
}

export function getLoadPersistenceAttempts() {
  if (persistenceSettings.provider === "browser") return ["browser"];
  if (persistenceSettings.provider === "local-api") return ["local-api", "browser"];
  if (persistenceSettings.provider === "gitlab") return ["browser", "gitlab"];
  return ["local-api", "browser", "gitlab"];
}

export function getActiveEditorProfileId() {
  return normalizeEditorProfileId(runtime.editorProfiles?.activeProfileId || DEFAULT_EDITOR_PROFILE_ID);
}

export function getActiveEditorProfile() {
  const activeProfileId = getActiveEditorProfileId();
  return runtime.editorProfiles.profiles.find((profile) => profile.id === activeProfileId) || runtime.editorProfiles.profiles[0];
}

function withProfileMapBackground(profile, mapBackground) {
  const normalized = normalizeMapBackground(mapBackground);
  const nextProfile = { ...profile };
  if (normalized) nextProfile.mapBackground = deepClone(normalized);
  else delete nextProfile.mapBackground;
  return nextProfile;
}

export function getActiveEditorProfileMapBackground() {
  return normalizeMapBackground(getActiveEditorProfile()?.mapBackground);
}

export function setActiveEditorProfileMapBackground(mapBackground) {
  const activeProfileId = getActiveEditorProfileId();
  runtime.editorProfiles = normalizeEditorProfileIndex({
    ...runtime.editorProfiles,
    profiles: runtime.editorProfiles.profiles.map((profile) =>
      profile.id === activeProfileId ? withProfileMapBackground(profile, mapBackground) : profile
    ),
  });
  saveEditorDraft(true, { skipHistory: true });
  return getActiveEditorProfileMapBackground();
}

export function getEditorProfileConfigStorageKey(profileId = getActiveEditorProfileId()) {
  return `${EDITOR_CONFIG_STORAGE_KEY}:${normalizeEditorProfileId(profileId)}`;
}

export function getEditorProfileSavedConfigStorageKey(profileId = getActiveEditorProfileId()) {
  return `${EDITOR_SAVED_CONFIG_STORAGE_KEY}:${normalizeEditorProfileId(profileId)}`;
}

export function getEditorProfileDraftDirtyStorageKey(profileId = getActiveEditorProfileId()) {
  return `${EDITOR_DRAFT_DIRTY_STORAGE_KEY}:${normalizeEditorProfileId(profileId)}`;
}

export function loadBrowserProfileIndex() {
  try {
    const raw = localStorage.getItem(EDITOR_PROFILE_INDEX_STORAGE_KEY);
    return raw ? normalizeEditorProfileIndex(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveBrowserProfileIndex(index = runtime.editorProfiles) {
  localStorage.setItem(EDITOR_PROFILE_INDEX_STORAGE_KEY, JSON.stringify(normalizeEditorProfileIndex(index)));
}

export function loadBrowserDeletedProfileIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EDITOR_PROFILE_DELETED_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map((id) => normalizeEditorProfileId(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveBrowserDeletedProfileIds(ids = runtime.deletedEditorProfileIds) {
  localStorage.setItem(EDITOR_PROFILE_DELETED_STORAGE_KEY, JSON.stringify([...new Set(ids.map((id) => normalizeEditorProfileId(id)).filter(Boolean))]));
}

export function loadBrowserConfig(profileId = getActiveEditorProfileId()) {
  try {
    const id = normalizeEditorProfileId(profileId);
    const raw = localStorage.getItem(getEditorProfileConfigStorageKey(id)) || (id === DEFAULT_EDITOR_PROFILE_ID ? localStorage.getItem(EDITOR_CONFIG_STORAGE_KEY) : null);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBrowserConfig(config, profileId = getActiveEditorProfileId()) {
  const id = normalizeEditorProfileId(profileId);
  localStorage.setItem(getEditorProfileConfigStorageKey(id), JSON.stringify(config));
  if (id === DEFAULT_EDITOR_PROFILE_ID) localStorage.setItem(EDITOR_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function loadBrowserSavedConfig(profileId = getActiveEditorProfileId()) {
  try {
    const raw = localStorage.getItem(getEditorProfileSavedConfigStorageKey(profileId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBrowserSavedConfig(config, profileId = getActiveEditorProfileId()) {
  localStorage.setItem(getEditorProfileSavedConfigStorageKey(profileId), JSON.stringify(config));
}

export function isLocalDraftDirty(profileId = getActiveEditorProfileId()) {
  try {
    const id = normalizeEditorProfileId(profileId);
    return localStorage.getItem(getEditorProfileDraftDirtyStorageKey(id)) === "true" || (id === DEFAULT_EDITOR_PROFILE_ID && localStorage.getItem(EDITOR_DRAFT_DIRTY_STORAGE_KEY) === "true");
  } catch {
    return false;
  }
}

export function setLocalDraftDirty(isDirty, profileId = getActiveEditorProfileId()) {
  const id = normalizeEditorProfileId(profileId);
  localStorage.setItem(getEditorProfileDraftDirtyStorageKey(id), String(isDirty));
  if (id === DEFAULT_EDITOR_PROFILE_ID) localStorage.setItem(EDITOR_DRAFT_DIRTY_STORAGE_KEY, String(isDirty));
}

function normalizeEditorHistory() {
  if (!runtime.editorHistory) {
    runtime.editorHistory = {
      past: [],
      present: null,
      future: [],
      suppress: false,
    };
  }
  if (!Array.isArray(runtime.editorHistory.past)) runtime.editorHistory.past = [];
  if (!Array.isArray(runtime.editorHistory.future)) runtime.editorHistory.future = [];
  return runtime.editorHistory;
}

function isSameEditorConfig(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function cloneEditorConfig(config) {
  return deepClone(config);
}

function markEditorDraftState(config, profileId = getActiveEditorProfileId()) {
  const savedConfig = loadBrowserSavedConfig(profileId);
  const isDirty = !isStoredConfig(savedConfig) || !isSameEditorConfig(config, savedConfig);
  saveBrowserConfig(config, profileId);
  setLocalDraftDirty(isDirty, profileId);
  runtime.persistenceStatus = {
    provider: isDirty ? "локальный черновик" : runtime.persistenceStatus.provider,
    message: isDirty ? "Есть несохранённые на сервере изменения." : "Профиль совпадает с последним сохранённым состоянием.",
  };
  return isDirty;
}

export function resetEditorHistory(config = buildEditorConfig()) {
  const history = normalizeEditorHistory();
  history.past = [];
  history.present = cloneEditorConfig(config);
  history.future = [];
  history.suppress = false;
}

export function recordEditorHistory(config = buildEditorConfig()) {
  const history = normalizeEditorHistory();
  if (history.suppress) return;
  const snapshot = cloneEditorConfig(config);
  if (!history.present) {
    history.present = snapshot;
    return;
  }
  if (isSameEditorConfig(history.present, snapshot)) return;
  history.past = [...history.past, history.present].slice(-EDITOR_HISTORY_LIMIT);
  history.present = snapshot;
  history.future = [];
}

export function getEditorHistoryState() {
  const history = normalizeEditorHistory();
  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function applyEditorHistoryConfig(config) {
  const snapshot = cloneEditorConfig(config);
  applyLoadedEditorConfig(snapshot);
  markEditorDraftState(snapshot);
}

export function undoEditorHistory() {
  const history = normalizeEditorHistory();
  if (!history.past.length) return false;
  const current = history.present || cloneEditorConfig(buildEditorConfig());
  const previous = history.past[history.past.length - 1];
  history.past = history.past.slice(0, -1);
  history.future = [current, ...history.future].slice(0, EDITOR_HISTORY_LIMIT);
  history.present = cloneEditorConfig(previous);
  history.suppress = true;
  try {
    applyEditorHistoryConfig(previous);
  } finally {
    history.suppress = false;
  }
  return true;
}

export function redoEditorHistory() {
  const history = normalizeEditorHistory();
  if (!history.future.length) return false;
  const current = history.present || cloneEditorConfig(buildEditorConfig());
  const next = history.future[0];
  history.future = history.future.slice(1);
  history.past = [...history.past, current].slice(-EDITOR_HISTORY_LIMIT);
  history.present = cloneEditorConfig(next);
  history.suppress = true;
  try {
    applyEditorHistoryConfig(next);
  } finally {
    history.suppress = false;
  }
  return true;
}

export async function resetActiveEditorProfileDraft() {
  const profileId = getActiveEditorProfileId();
  const { config, provider } = await loadSavedEditorProfileConfig(profileId);
  const snapshot = cloneEditorConfig(config);
  applyLoadedEditorConfig(snapshot);
  saveBrowserConfig(snapshot, profileId);
  saveBrowserSavedConfig(snapshot, profileId);
  setLocalDraftDirty(false, profileId);
  clearEditorChangeSummary();
  resetEditorHistory(snapshot);
  runtime.persistenceStatus = {
    provider,
    message: `Профиль «${getActiveEditorProfile()?.name || profileId}» возвращён к последнему сохранённому состоянию.`,
  };
  return { profile: getActiveEditorProfile(), provider };
}

export function saveEditorDraft(isDirty = isLocalDraftDirty(), options = {}) {
  try {
    if (isDirty && !options.skipHistory) recordEditorHistory();
    saveBrowserProfileIndex(runtime.editorProfiles);
    saveBrowserConfig(buildEditorConfig(), getActiveEditorProfileId());
    localStorage.setItem(EDITOR_MODE_STORAGE_KEY, runtime.appMode);
    localStorage.setItem(EDITOR_MODE_PHASE_STORAGE_KEY, getPhaseMode());
    setLocalDraftDirty(isDirty);
    runtime.persistenceStatus = {
      provider: isDirty ? "локальный черновик" : runtime.persistenceStatus.provider,
      message: isDirty ? "Есть несохранённые на сервере изменения." : runtime.persistenceStatus.message,
    };
  } catch {
    showToast("Не удалось сохранить локальный черновик.");
  }
}

export function buildEditorProfileSavePayload(activeConfig = buildEditorConfig()) {
  const profileIndex = normalizeEditorProfileIndex(runtime.editorProfiles);
  const activeProfileId = profileIndex.activeProfileId;

  return {
    version: EDITOR_PROFILE_INDEX_VERSION,
    format: EDITOR_PROFILE_FORMAT,
    activeProfileId,
    profiles: profileIndex.profiles,
    profileId: activeProfileId,
    config: activeConfig,
    deletedProfileIds: [...new Set((runtime.deletedEditorProfileIds || []).map((id) => normalizeEditorProfileId(id)).filter(Boolean))],
  };
}

function assertValidEditorProfileSavePayload(payload) {
  const errors = collectEditorProfileSavePayloadErrors(payload, "editor profile save payload", {
    resources: resourceDefs,
    stats: statDefs,
    upgrades,
    validateGraph: true,
  });
  if (errors.length) throw new Error(`Некорректные данные профилей редактора: ${errors.join("; ")}`);
}

function clearSavedProfileDraftState(profileId) {
  setLocalDraftDirty(false, profileId);
  saveBrowserProfileIndex(runtime.editorProfiles);
}

function getUniqueEditorProfileId(name) {
  const existingIds = new Set(runtime.editorProfiles.profiles.map((profile) => profile.id));
  const baseId = normalizeEditorProfileId(name, "profile");
  let id = baseId;
  let index = 2;
  while (existingIds.has(id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  return id;
}

export function createEditorProfile(name, sourceConfig = buildEditorConfig()) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw new Error("Название профиля обязательно.");
  const profile = {
    id: getUniqueEditorProfileId(trimmedName),
    name: trimmedName,
  };
  const sourceProfile = getActiveEditorProfile();
  runtime.editorProfiles = normalizeEditorProfileIndex({
    ...runtime.editorProfiles,
    activeProfileId: profile.id,
    profiles: [...runtime.editorProfiles.profiles, withProfileMapBackground(profile, sourceProfile?.mapBackground)],
  });
  runtime.deletedEditorProfileIds = runtime.deletedEditorProfileIds.filter((id) => id !== profile.id);
  saveBrowserDeletedProfileIds(runtime.deletedEditorProfileIds);
  saveBrowserProfileIndex(runtime.editorProfiles);
  saveBrowserConfig(sourceConfig, profile.id);
  setLocalDraftDirty(true, profile.id);
  return profile;
}

export function removeBrowserProfileDraft(profileId) {
  const id = normalizeEditorProfileId(profileId);
  try {
    localStorage.removeItem(getEditorProfileConfigStorageKey(id));
    localStorage.removeItem(getEditorProfileSavedConfigStorageKey(id));
    localStorage.removeItem(getEditorProfileDraftDirtyStorageKey(id));
  } catch {
    showToast("Не удалось очистить локальный черновик профиля.");
  }
}

export function deleteEditorProfile(profileId) {
  const id = normalizeEditorProfileId(profileId);
  const profile = runtime.editorProfiles.profiles.find((item) => item.id === id);
  if (!profile) return null;
  if (runtime.editorProfiles.profiles.length <= 1) throw new Error("Нельзя удалить последний профиль.");

  const nextProfiles = runtime.editorProfiles.profiles.filter((item) => item.id !== id);
  const nextActiveProfileId = runtime.editorProfiles.activeProfileId === id ? nextProfiles[0].id : runtime.editorProfiles.activeProfileId;
  runtime.editorProfiles = normalizeEditorProfileIndex({
    ...runtime.editorProfiles,
    activeProfileId: nextActiveProfileId,
    profiles: nextProfiles,
  });
  runtime.deletedEditorProfileIds = [...new Set([...runtime.deletedEditorProfileIds, id])];
  saveBrowserDeletedProfileIds(runtime.deletedEditorProfileIds);
  removeBrowserProfileDraft(id);
  saveBrowserProfileIndex(runtime.editorProfiles);
  setLocalDraftDirty(true, nextActiveProfileId);
  return { deleted: profile, nextActiveProfileId };
}

export function overwriteEditorProfile(targetProfileId, sourceConfig = buildEditorConfig()) {
  const activeProfileId = getActiveEditorProfileId();
  const targetId = normalizeEditorProfileId(targetProfileId, "");
  const sourceProfile = getActiveEditorProfile();
  const targetProfile = runtime.editorProfiles.profiles.find((profile) => profile.id === targetId);

  if (!targetProfile) throw new Error("Профиль для перезаписи не найден.");
  if (targetId === activeProfileId) throw new Error("Нельзя перезаписать активный профиль самим собой.");

  saveBrowserConfig(deepClone(sourceConfig), targetId);
  runtime.editorProfiles = normalizeEditorProfileIndex({
    ...runtime.editorProfiles,
    activeProfileId: targetId,
    profiles: runtime.editorProfiles.profiles.map((profile) =>
      profile.id === targetId ? withProfileMapBackground(profile, sourceProfile?.mapBackground) : profile
    ),
  });
  setLocalDraftDirty(true, targetId);
  saveBrowserProfileIndex(runtime.editorProfiles);
  return { source: sourceProfile, target: targetProfile, activeProfileId: targetId };
}

export async function switchEditorProfile(profileId) {
  const id = normalizeEditorProfileId(profileId);
  if (!runtime.editorProfiles.profiles.some((profile) => profile.id === id)) throw new Error("Профиль не найден.");
  if (id === getActiveEditorProfileId()) return null;

  saveEditorDraft(isLocalDraftDirty());
  runtime.editorProfiles = normalizeEditorProfileIndex({
    ...runtime.editorProfiles,
    activeProfileId: id,
  });
  saveBrowserProfileIndex(runtime.editorProfiles);
  const provider = await loadEditorProfileConfig(id);
  return { profile: getActiveEditorProfile(), provider };
}

export async function loadLocalApiProfileIndex() {
  const response = await fetch("/api/editor-profiles", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Локальный API вернул ${response.status}`);
  return normalizeEditorProfileIndex(await response.json());
}

export async function loadLocalApiConfig(profileId = getActiveEditorProfileId()) {
  const url = new URL(persistenceSettings.localApiUrl, window.location.href);
  url.searchParams.set("profile", normalizeEditorProfileId(profileId));
  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Локальный API вернул ${response.status}`);
  return response.json();
}

export async function loadSavedEditorProfileConfig(profileId = getActiveEditorProfileId()) {
  const id = normalizeEditorProfileId(profileId);
  const errors = [];

  for (const provider of getLoadPersistenceAttempts()) {
    try {
      let saved = null;
      if (provider === "local-api") saved = await loadLocalApiConfig(id);
      if (provider === "gitlab") {
        saved = await loadGitlabSplitConfig(getEditorProfileDirPath(gitlabConfigDirPath(), id));
        if (!saved && id === DEFAULT_EDITOR_PROFILE_ID) saved = await loadGitlabSplitConfig(gitlabConfigDirPath());
      }
      if (provider === "browser") saved = loadBrowserSavedConfig(id) || (!isLocalDraftDirty(id) ? loadBrowserConfig(id) : null);

      if (isStoredConfig(saved)) return { config: saved, provider };
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }

  throw new Error(errors.length ? errors.join(" | ") : "Сохранённое состояние профиля не найдено.");
}

export async function saveLocalApiConfig(config) {
  const payload = buildEditorProfileSavePayload(config);
  assertValidEditorProfileSavePayload(payload);
  const indexResponse = await fetchWithTimeout(
    "/api/editor-profiles",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { timeoutMs: LOCAL_API_REQUEST_TIMEOUT_MS, operation: "Сохранение индекса профилей" }
  );
  if (!indexResponse.ok) throw new Error(await getApiResponseError(indexResponse, "Локальный API индекса"));

  const url = new URL(persistenceSettings.localApiUrl, window.location.href);
  url.searchParams.set("profile", payload.profileId);
  const configResponse = await fetchWithTimeout(
    url.toString(),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.config),
    },
    { timeoutMs: LOCAL_API_REQUEST_TIMEOUT_MS, operation: "Сохранение профиля" }
  );
  if (!configResponse.ok) throw new Error(await getApiResponseError(configResponse, "Локальный API профиля"));

  await Promise.all(
    payload.deletedProfileIds.map(async (profileId) => {
      const deleteUrl = new URL(persistenceSettings.localApiUrl, window.location.href);
      deleteUrl.searchParams.set("profile", profileId);
      const response = await fetchWithTimeout(
        deleteUrl.toString(),
        { method: "DELETE" },
        { timeoutMs: LOCAL_API_REQUEST_TIMEOUT_MS, operation: "Удаление профиля" }
      );
      if (!response.ok) throw new Error(await getApiResponseError(response, "Локальный API удаления"));
    })
  );
}

export async function publishLocalApiConfig(config) {
  const payload = buildEditorProfileSavePayload(config);
  assertValidEditorProfileSavePayload(payload);
  const response = await fetchWithTimeout(
    "/api/editor-publish",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { timeoutMs: PUBLISH_REQUEST_TIMEOUT_MS, operation: "Публикация профиля" }
  );
  if (!response.ok) throw new Error(await getApiResponseError(response, "Локальный API публикации"));
  return response.json();
}

export function gitlabProjectApiUrl(path = "") {
  const baseUrl = persistenceSettings.gitlabBaseUrl.replace(/\/$/, "");
  const projectId = encodeURIComponent(persistenceSettings.gitlabProjectId);
  return `${baseUrl}/api/v4/projects/${projectId}${path}`;
}

export function gitlabFileApiUrl(filePath) {
  return gitlabProjectApiUrl(`/repository/files/${encodeURIComponent(filePath)}`);
}

export function gitlabCommitsApiUrl() {
  return gitlabProjectApiUrl("/repository/commits");
}

export function gitlabConfigDirPath() {
  return getEditorConfigDirFromPath(persistenceSettings.gitlabFilePath);
}

export function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function gitlabHeaders() {
  return {
    "Content-Type": "application/json",
    "PRIVATE-TOKEN": getGitlabToken(),
  };
}

export async function loadGitlabConfig() {
  if (!hasGitlabSettings()) throw new Error("GitLab не настроен.");
  return loadGitlabSplitConfig(getEditorProfileDirPath(gitlabConfigDirPath(), getActiveEditorProfileId()));
}

export async function loadGitlabJsonFile(filePath) {
  const url = `${gitlabFileApiUrl(filePath)}?ref=${encodeURIComponent(persistenceSettings.gitlabBranch)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: gitlabHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitLab вернул ${response.status}`);
  const file = await response.json();
  return JSON.parse(decodeBase64Utf8(file.content));
}

export async function loadGitlabProfileIndex() {
  if (!hasGitlabSettings()) throw new Error("GitLab не настроен.");
  const configDir = gitlabConfigDirPath();
  const profileIndex = await loadGitlabJsonFile(getEditorProfileIndexPath(configDir));
  return profileIndex ? normalizeEditorProfileIndex(profileIndex) : null;
}

export async function loadGitlabSplitConfig(configDir = gitlabConfigDirPath()) {
  const manifest = await loadGitlabJsonFile(getEditorConfigManifestPath(configDir));
  if (!manifest || manifest.version !== EDITOR_CONFIG_VERSION) return null;
  const parts = {};
  await Promise.all(
    EDITOR_CONFIG_COLLECTIONS.map(async (collection) => {
      const content = await loadGitlabJsonFile(getEditorConfigFilePath(configDir, collection.file));
      parts[collection.key] = content ?? collection.fallback;
    })
  );
  return composeEditorConfig(parts);
}

export async function gitlabFileExists(filePath) {
  const url = `${gitlabFileApiUrl(filePath)}?ref=${encodeURIComponent(persistenceSettings.gitlabBranch)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: gitlabHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`GitLab вернул ${response.status}`);
  return true;
}

async function createGitlabWriteAction(filePath, content) {
  const exists = await gitlabFileExists(filePath);
  return {
    action: exists ? "update" : "create",
    file_path: filePath,
    content: `${JSON.stringify(content, null, 2)}\n`,
  };
}

async function createGitlabDeleteActions(filePaths) {
  const actions = await Promise.all(
    filePaths.map(async (filePath) => {
      const exists = await gitlabFileExists(filePath);
      return exists
        ? {
            action: "delete",
            file_path: filePath,
          }
        : null;
    })
  );
  return actions.filter(Boolean);
}

export async function publishGitlabConfig(config) {
  if (!hasGitlabSettings()) throw new Error("GitLab не настроен.");
  const configDir = gitlabConfigDirPath();
  const payload = buildEditorProfileSavePayload(config);
  assertValidEditorProfileSavePayload(payload);
  const writeActions = [
    await createGitlabWriteAction(getEditorProfileIndexPath(configDir), {
      version: payload.version,
      format: payload.format,
      activeProfileId: payload.activeProfileId,
      profiles: payload.profiles,
    }),
  ];

  const profileDir = getEditorProfileDirPath(configDir, payload.profileId);
  const profileActions = await Promise.all(
    getEditorConfigFileEntries(payload.config).map((entry) => createGitlabWriteAction(getEditorConfigFilePath(profileDir, entry.file), entry.content))
  );
  writeActions.push(...profileActions);

  const deletedFilePaths = payload.deletedProfileIds.flatMap((profileId) => {
    const profileDir = getEditorProfileDirPath(configDir, profileId);
    return [EDITOR_CONFIG_MANIFEST_FILE, ...EDITOR_CONFIG_COLLECTIONS.map((collection) => collection.file)].map((fileName) =>
      getEditorConfigFilePath(profileDir, fileName)
    );
  });
  const deleteActions = await createGitlabDeleteActions(deletedFilePaths);
  const actions = [...writeActions, ...deleteActions];

  const response = await fetch(gitlabCommitsApiUrl(), {
    method: "POST",
    headers: gitlabHeaders(),
    body: JSON.stringify({
      branch: persistenceSettings.gitlabBranch,
      commit_message: `Publish editor profile ${payload.profileId}`,
      actions,
    }),
  });
  if (!response.ok) throw new Error(`GitLab вернул ${response.status}`);
}

export function serializeAgent(agent) {
  return normalizeAgentBlueprint(agent, traitCatalog);
}

export function serializePath(edge) {
  return {
    id: edge.id,
    a: edge.a,
    b: edge.b,
    type: edge.type,
    name: edge.name,
    energy: edge.energy,
    enabled: edge.enabled !== false,
    toll: deepClone(edge.toll || {}),
    color: edge.color || "",
    from: edge.from ? deepClone(edge.from) : null,
    bendEnabled: Boolean(edge.bendEnabled),
    bend: edge.bendEnabled && edge.bend ? deepClone(edge.bend) : null,
    to: edge.to ? deepClone(edge.to) : null,
  };
}

export function createTaskFromConfig(savedTask) {
  return createNormalizedTaskFromConfig(savedTask, {
    fallbackLocationId: locations[0]?.id || "",
  });
}

export function buildEditorConfig() {
  return {
    version: EDITOR_CONFIG_VERSION,
    gameSettings: deepClone(gameSettings),
    initialResources: deepClone(runtime.initialResources),
    barSettings: deepClone(runtime.barSettings),
    agents: runtime.agentBlueprints.map(serializeAgent),
    traits: traitCatalog.map(serializeTrait),
    upgrades: upgrades.map(serializeUpgrade),
    events: eventDeck.map(serializeEvent),
    statusEffects: statusEffects.map(serializeStatus),
    activities: activities.map(serializeActivity),
    zones: deepClone(zones),
    paths: paths.map(serializePath),
    locations: locations.map(serializeLocation),
    tasks: tasks.map((task) => stabilizeTaskLocationEffectLists(serializeTask(task), locations.find((location) => location.id === task.locationId))),
  };
}

export async function saveEditorConfig(options = {}) {
  const config = buildEditorConfig();
  const errors = [];
  const changeSummary = getEditorChangeSummary();
  const payload = buildEditorProfileSavePayload(config);

  saveEditorDraft(true);

  for (const provider of getWorkspaceSaveAttempts()) {
    try {
      if (provider === "local-api") await saveLocalApiConfig(config);
      if (provider === "browser") {
        saveBrowserProfileIndex(runtime.editorProfiles);
        saveBrowserConfig(payload.config, payload.profileId);
      }
      saveBrowserSavedConfig(payload.config, payload.profileId);
      clearSavedProfileDraftState(payload.profileId);
      saveEditorDraft(false);
      runtime.persistenceStatus = {
        provider,
        message: provider === "browser" ? "Профиль сохранён в браузерном workspace." : "Профиль сохранён в локальном workspace.",
      };
      clearEditorChangeSummary();
      if (options.showToast) showSaveToast(provider, changeSummary);
      return provider;
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }

  runtime.persistenceStatus = {
    provider: "ошибка",
    message: `${errors.join(" | ") || "Не удалось сохранить правки."} Локальный черновик сохранён.`,
  };
  if (options.showToast) showToast("Не удалось сохранить профиль в workspace.");
  return null;
}

export async function publishEditorConfig(options = {}) {
  const errors = [];
  let config;
  let payload;
  try {
    config = buildEditorConfig();
    payload = buildEditorProfileSavePayload(config);
    assertValidEditorProfileSavePayload(payload);
  } catch (error) {
    runtime.persistenceStatus = { provider: "ошибка", message: `Публикация невозможна: ${error.message || error}` };
    if (options.showToast) showToast(runtime.persistenceStatus.message);
    return null;
  }

  const workspaceProvider = await saveEditorConfig({ showToast: false });
  if (!workspaceProvider) {
    if (options.showToast) showToast("Публикация отменена: сначала не удалось сохранить workspace.");
    return null;
  }

  for (const provider of getPublishAttempts()) {
    try {
      let publishResult = null;
      if (provider === "local-api") publishResult = await publishLocalApiConfig(config);
      if (provider === "gitlab") await publishGitlabConfig(config);
      runtime.deletedEditorProfileIds = [];
      saveBrowserDeletedProfileIds([]);
      const publishedProfileName = getActiveEditorProfile()?.name || payload.profileId;
      const commitDetails = publishResult?.commit ? ` и отправлен в origin/main (${publishResult.commit})` : "";
      runtime.persistenceStatus = {
        provider: `опубликовано: ${provider}`,
        message: `Профиль «${publishedProfileName}» опубликован в Git-снимок${commitDetails}.`,
      };
      if (options.showToast) showToast(runtime.persistenceStatus.message);
      return provider;
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }

  runtime.persistenceStatus = {
    provider: "ошибка публикации",
    message: errors.join(" | ") || "Для выбранного режима публикация недоступна.",
  };
  if (options.showToast) showToast(`Не удалось опубликовать профиль: ${runtime.persistenceStatus.message}`);
  return null;
}

export function applyLoadedEditorConfig(saved) {
  if (!saved) return;
  const migratedConfig = migrateEditorConfig(saved);
  const patch = buildEditorRuntimePatch(migratedConfig, {
    currentTasks: tasks,
    currentLocations: locations,
    currentTraitCatalog: traitCatalog,
    fallbackLocationId: locations[0]?.id || "",
  });
  applyEditorRuntimePatch({ gameSettings, runtime, traitCatalog, upgrades, eventDeck, statusEffects, activities, zones, paths, locations, tasks }, patch);
  return migratedConfig;
}

export async function loadEditorProfileIndex() {
  const errors = [];
  const browserIndex = loadBrowserProfileIndex();

  for (const provider of getLoadPersistenceAttempts()) {
    try {
      let profileIndex = null;
      if (provider === "local-api") profileIndex = await loadLocalApiProfileIndex();
      if (provider === "gitlab") profileIndex = await loadGitlabProfileIndex();
      if (provider === "browser") profileIndex = browserIndex;

      if (profileIndex) {
        runtime.editorProfiles = normalizeEditorProfileIndex(profileIndex);
        runtime.deletedEditorProfileIds = loadBrowserDeletedProfileIds();
        if (provider !== "browser") saveBrowserProfileIndex(runtime.editorProfiles);
        return provider;
      }
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }

  runtime.editorProfiles = browserIndex || createEditorProfileIndex();
  runtime.deletedEditorProfileIds = loadBrowserDeletedProfileIds();
  if (errors.length) {
    runtime.persistenceStatus = {
      provider: "профили по умолчанию",
      message: errors.join(" | "),
    };
  }
  return null;
}

export async function loadEditorProfileConfig(profileId = getActiveEditorProfileId()) {
  const id = normalizeEditorProfileId(profileId);
  const errors = [];
  const browserDraft = loadBrowserConfig(id);

  if (isLocalDraftDirty(id) && isStoredConfig(browserDraft)) {
    applyLoadedEditorConfig(browserDraft);
    runtime.persistenceStatus = {
      provider: "локальный черновик",
      message: `Загружены несохранённые изменения профиля «${getActiveEditorProfile()?.name || id}».`,
    };
    return "browser-draft";
  }

  for (const provider of getLoadPersistenceAttempts()) {
    try {
      let saved = null;
      if (provider === "local-api") saved = await loadLocalApiConfig(id);
      if (provider === "gitlab") {
        saved = await loadGitlabSplitConfig(getEditorProfileDirPath(gitlabConfigDirPath(), id));
      }
      if (provider === "browser") saved = browserDraft;

      if (isStoredConfig(saved)) {
        const migratedConfig = applyLoadedEditorConfig(saved);
        saveBrowserSavedConfig(migratedConfig, id);
        if (provider !== "browser") {
          saveBrowserConfig(migratedConfig, id);
          setLocalDraftDirty(false, id);
        }
        runtime.persistenceStatus = {
          provider,
          message: provider === "browser" ? "Загружено из fallback браузера." : `Загружен профиль «${getActiveEditorProfile()?.name || id}».`,
        };
        return provider;
      }
    } catch (error) {
      errors.push(`${provider}: ${error.message || error}`);
    }
  }

  runtime.persistenceStatus = {
    provider: "по умолчанию",
    message: errors.length ? errors.join(" | ") : `Сохранённого профиля «${getActiveEditorProfile()?.name || id}» пока нет.`,
  };
  return null;
}

export async function loadEditorConfig() {
  await loadEditorProfileIndex();
  return loadEditorProfileConfig(getActiveEditorProfileId());
}
