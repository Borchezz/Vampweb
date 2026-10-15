import { normalizeBarSettings } from "./bar-settings.js";

export const EDITOR_CONFIG_VERSION = 2;
export const EDITOR_CONFIG_DIR_PATH = "data/editor";
export const EDITOR_CONFIG_MANIFEST_FILE = "manifest.json";
export const EDITOR_CONFIG_FORMAT = "bloodbar-editor-split-config";
export const EDITOR_PROFILE_INDEX_VERSION = 1;
export const EDITOR_PROFILE_FORMAT = "bloodbar-editor-profiles";
export const EDITOR_PROFILE_INDEX_FILE = "profiles.json";
export const EDITOR_PROFILE_DIR = "profiles";
export const DEFAULT_EDITOR_PROFILE_ID = "default";
export const DEFAULT_EDITOR_PROFILE_NAME = "Дефолт";
export const DEFAULT_MAP_BACKGROUND_NAME = "Стандартная карта";
export const DEFAULT_MAP_BACKGROUND_SRC = "assets/prototype-map-2-bigger-city.png";

export const EDITOR_CONFIG_COLLECTIONS = [
  { key: "gameSettings", file: "settings.json", fallback: {} },
  { key: "initialResources", file: "resources.json", fallback: {} },
  { key: "barSettings", file: "bar.json", fallback: {} },
  { key: "agents", file: "agents.json", fallback: [] },
  { key: "traits", file: "traits.json", fallback: undefined },
  { key: "upgrades", file: "upgrades.json", fallback: [] },
  { key: "events", file: "events.json", fallback: [] },
  { key: "statusEffects", file: "status-effects.json", fallback: [] },
  { key: "activities", file: "activities.json", fallback: [] },
  { key: "zones", file: "zones.json", fallback: [] },
  { key: "paths", file: "paths.json", fallback: [] },
  { key: "locations", file: "locations.json", fallback: [] },
  { key: "tasks", file: "tasks.json", fallback: [] },
];

export function normalizeConfigPath(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function dirname(filePath) {
  const normalized = normalizeConfigPath(filePath);
  const separatorIndex = normalized.lastIndexOf("/");
  return separatorIndex === -1 ? "" : normalized.slice(0, separatorIndex);
}

function joinPath(...parts) {
  return parts
    .map(normalizeConfigPath)
    .filter(Boolean)
    .join("/");
}

export function getEditorConfigDirFromPath(configPath = EDITOR_CONFIG_DIR_PATH) {
  const normalized = normalizeConfigPath(configPath) || EDITOR_CONFIG_DIR_PATH;
  if (normalized.endsWith(`/${EDITOR_CONFIG_MANIFEST_FILE}`)) return dirname(normalized) || EDITOR_CONFIG_DIR_PATH;
  if (normalized === EDITOR_CONFIG_MANIFEST_FILE) return EDITOR_CONFIG_DIR_PATH;
  if (normalized.endsWith(".json")) return dirname(normalized) || EDITOR_CONFIG_DIR_PATH;
  return normalized;
}

export function getEditorConfigManifestPath(configPath = EDITOR_CONFIG_DIR_PATH) {
  return joinPath(getEditorConfigDirFromPath(configPath), EDITOR_CONFIG_MANIFEST_FILE);
}

export function getEditorConfigFilePath(configDir, fileName) {
  return joinPath(configDir || EDITOR_CONFIG_DIR_PATH, fileName);
}

export function isStoredConfig(value) {
  return value && typeof value === "object" && value.version === EDITOR_CONFIG_VERSION;
}

export function normalizeEditorProfileId(value, fallback = DEFAULT_EDITOR_PROFILE_ID) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function getEditorProfileIndexPath(configDir = EDITOR_CONFIG_DIR_PATH) {
  return getEditorConfigFilePath(getEditorConfigDirFromPath(configDir), EDITOR_PROFILE_INDEX_FILE);
}

export function getEditorProfileDirPath(configDir = EDITOR_CONFIG_DIR_PATH, profileId = DEFAULT_EDITOR_PROFILE_ID) {
  return joinPath(getEditorConfigDirFromPath(configDir), EDITOR_PROFILE_DIR, normalizeEditorProfileId(profileId));
}

export function getEditorProfileManifestPath(configDir = EDITOR_CONFIG_DIR_PATH, profileId = DEFAULT_EDITOR_PROFILE_ID) {
  return getEditorConfigFilePath(getEditorProfileDirPath(configDir, profileId), EDITOR_CONFIG_MANIFEST_FILE);
}

export function createDefaultEditorProfile() {
  return {
    id: DEFAULT_EDITOR_PROFILE_ID,
    name: DEFAULT_EDITOR_PROFILE_NAME,
  };
}

export function normalizeMapBackground(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const src = String(value.src || "").trim();
  if (!src) return null;
  const name = String(value.name || "").trim() || "Пользовательская карта";
  return { name, src };
}

function normalizeEditorProfile(profile, index = 0) {
  const fallbackId = index === 0 ? DEFAULT_EDITOR_PROFILE_ID : `profile-${index + 1}`;
  const id = normalizeEditorProfileId(profile?.id || profile?.name, fallbackId);
  const name = String(profile?.name || "").trim() || (id === DEFAULT_EDITOR_PROFILE_ID ? DEFAULT_EDITOR_PROFILE_NAME : id);
  const mapBackground = normalizeMapBackground(profile?.mapBackground);
  return mapBackground ? { id, name, mapBackground } : { id, name };
}

export function normalizeEditorProfileIndex(value = {}) {
  const sourceProfiles = Array.isArray(value?.profiles) ? value.profiles : [];
  const profiles = [];
  const seenIds = new Set();

  sourceProfiles.forEach((profile, index) => {
    const normalized = normalizeEditorProfile(profile, index);
    if (seenIds.has(normalized.id)) return;
    profiles.push(normalized);
    seenIds.add(normalized.id);
  });

  if (!seenIds.has(DEFAULT_EDITOR_PROFILE_ID)) {
    profiles.unshift(createDefaultEditorProfile());
    seenIds.add(DEFAULT_EDITOR_PROFILE_ID);
  }

  const activeProfileId = normalizeEditorProfileId(value?.activeProfileId || profiles[0]?.id);
  return {
    version: EDITOR_PROFILE_INDEX_VERSION,
    format: EDITOR_PROFILE_FORMAT,
    activeProfileId: seenIds.has(activeProfileId) ? activeProfileId : profiles[0].id,
    profiles,
  };
}

export function createEditorProfileIndex(profiles = [createDefaultEditorProfile()], activeProfileId = DEFAULT_EDITOR_PROFILE_ID) {
  return normalizeEditorProfileIndex({
    version: EDITOR_PROFILE_INDEX_VERSION,
    format: EDITOR_PROFILE_FORMAT,
    activeProfileId,
    profiles,
  });
}

export function createEditorConfigManifest() {
  return {
    version: EDITOR_CONFIG_VERSION,
    format: EDITOR_CONFIG_FORMAT,
    collections: Object.fromEntries(EDITOR_CONFIG_COLLECTIONS.map((collection) => [collection.key, collection.file])),
  };
}

export function splitEditorConfig(config) {
  return {
    manifest: createEditorConfigManifest(),
    gameSettings: { ...(config.gameSettings || {}) },
    initialResources: { ...(config.initialResources || {}) },
    barSettings: normalizeBarSettings(config.barSettings),
    agents: Array.isArray(config.agents) ? config.agents : [],
    traits: Array.isArray(config.traits) ? config.traits : [],
    upgrades: Array.isArray(config.upgrades) ? config.upgrades : [],
    events: Array.isArray(config.events) ? config.events : [],
    statusEffects: Array.isArray(config.statusEffects) ? config.statusEffects : [],
    activities: Array.isArray(config.activities) ? config.activities : [],
    zones: Array.isArray(config.zones) ? config.zones : [],
    paths: Array.isArray(config.paths) ? config.paths : [],
    locations: Array.isArray(config.locations) ? config.locations : [],
    tasks: Array.isArray(config.tasks) ? config.tasks : [],
  };
}

export function getEditorConfigFileEntries(config) {
  const split = splitEditorConfig(config);
  return [
    { key: "manifest", file: EDITOR_CONFIG_MANIFEST_FILE, content: split.manifest },
    ...EDITOR_CONFIG_COLLECTIONS.map((collection) => ({
      key: collection.key,
      file: collection.file,
      content: split[collection.key],
    })),
  ];
}

export function composeEditorConfig(parts = {}) {
  return {
    version: EDITOR_CONFIG_VERSION,
    gameSettings: parts.gameSettings && typeof parts.gameSettings === "object" && !Array.isArray(parts.gameSettings) ? parts.gameSettings : {},
    initialResources: parts.initialResources || {},
    barSettings: normalizeBarSettings(parts.barSettings),
    agents: Array.isArray(parts.agents) ? parts.agents : [],
    traits: Array.isArray(parts.traits) ? parts.traits : undefined,
    upgrades: Array.isArray(parts.upgrades) ? parts.upgrades : [],
    events: Array.isArray(parts.events) ? parts.events : [],
    statusEffects: Array.isArray(parts.statusEffects) ? parts.statusEffects : [],
    activities: Array.isArray(parts.activities) ? parts.activities : [],
    zones: Array.isArray(parts.zones) ? parts.zones : [],
    paths: Array.isArray(parts.paths) ? parts.paths : [],
    locations: Array.isArray(parts.locations) ? parts.locations : [],
    tasks: Array.isArray(parts.tasks) ? parts.tasks : [],
  };
}
