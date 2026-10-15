import { deepClone } from "./utils.js";
import { RESOURCE_DEFINITIONS } from "./resource-catalog.js";
import { createEditorProfileIndex } from "./editor-config-format.js";
import {
  BASE_DIE_OPTIONS,
  DEFAULT_TASK_GAME_SETTINGS,
  sanitizeTaskMechanicSettings,
  ADVANTAGE_DIE_OPTIONS,
  TASK_MECHANIC_OPTIONS,
} from "./task-mechanic-registry.js";
import { cloneTaskDifficultyLevels, normalizeTaskDifficultyLevels } from "./task-difficulty-settings.js";
import { getPhaseMode } from "./phase-mode.js";
import { DEFAULT_BAR_SETTINGS } from "./bar-settings.js";

export const WEEKDAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
export const WORKING_DAYS_PER_WEEK = 5;
export const EDITOR_CONFIG_STORAGE_KEY = "vampire-bar-agents-editor-config-v1";
export const EDITOR_SAVED_CONFIG_STORAGE_KEY = "vampire-bar-agents-editor-saved-config-v1";
export const EDITOR_PROFILE_INDEX_STORAGE_KEY = "vampire-bar-agents-editor-profiles-v1";
export const EDITOR_PROFILE_DELETED_STORAGE_KEY = "vampire-bar-agents-editor-deleted-profiles-v1";
export const EDITOR_MODE_STORAGE_KEY = "vampire-bar-agents-mode-v1";
export const EDITOR_MODE_PHASE_STORAGE_KEY = "vampire-bar-agents-mode-phase-v1";
export const EDITOR_DRAFT_DIRTY_STORAGE_KEY = "vampire-bar-agents-editor-draft-dirty-v1";
export const PERSISTENCE_SETTINGS_STORAGE_KEY = "vampire-bar-agents-persistence-settings-v1";
export const GAME_SETTINGS_STORAGE_KEY = "vampire-bar-agents-game-settings-v1";
export const GITLAB_TOKEN_STORAGE_KEY = "vampire-bar-agents-gitlab-token-v1";

export function createInitialState() {
  return {
  day: 1,
  selectedAgentId: "anya",
  selectedLocationId: "donor-center",
  locationPanelOpen: false,
  routePlanner: {
    planning: false,
    collapsed: true,
    routes: {},
  },
  openLocationShopId: "",
  locationMechanics: {
    shops: {},
    counters: {},
    scales: {},
    taskLocks: {},
    taskEffects: {},
    triggeredThresholds: {},
  },
  pathStates: {},
  locationVisibility: {},
  weekend: {
    active: false,
    completedActivityIds: [],
  },
  resources: {
    money: 20,
    bloodTier1: 4,
    bloodTier2: 0,
    bloodTier3: 0,
    additiveTier1: 0,
    additiveTier2: 0,
    reputation: 0,
    debt: 0,
  },
  barSettings: { ...DEFAULT_BAR_SETTINGS },
  autoServiceLastRun: { drinks: 0, money: 0, byTier: [] },
  agents: [
    {
      id: "anya",
      name: "Аня",
      role: "Лаборант",
      portrait: "А",
      color: "#dfb257",
      maxEnergy: 20,
      energy: 10,
      baseRecovery: 8,
      fatigue: 0,
      isMainCharacter: false,
      sympathy: 20,
      overtimeMax: 5,
      overtimeLeft: 5,
      locationId: "donor-center",
      startLocationId: "donor-center",
      traits: [],
      sympathyTraits: [],
      statuses: [],
    },
    {
      id: "kolya",
      name: "Коля",
      role: "Курьер",
      portrait: "К",
      color: "#48b6a7",
      maxEnergy: 36,
      energy: 24,
      baseRecovery: 8,
      fatigue: 0,
      isMainCharacter: false,
      sympathy: 5,
      overtimeMax: 10,
      overtimeLeft: 10,
      locationId: "wholesale",
      startLocationId: "wholesale",
      traits: [],
      sympathyTraits: [],
      statuses: [],
    },
    {
      id: "ksenia",
      name: "Ксения",
      role: "Маркетолог",
      portrait: "Кс",
      color: "#8a73db",
      maxEnergy: 32,
      energy: 16,
      baseRecovery: 8,
      fatigue: 0,
      isMainCharacter: false,
      sympathy: -5,
      overtimeMax: 8,
      overtimeLeft: 8,
      locationId: "upgrade-shop",
      startLocationId: "upgrade-shop",
      traits: [],
      sympathyTraits: [],
      statuses: [],
    },
    {
      id: "denis",
      name: "Денис",
      role: "Дикая карта",
      portrait: "Д",
      color: "#6d9fce",
      maxEnergy: 20,
      energy: 20,
      baseRecovery: 8,
      fatigue: 0,
      isMainCharacter: false,
      sympathy: 0,
      overtimeMax: 6,
      overtimeLeft: 6,
      locationId: "bench",
      startLocationId: "bench",
      traits: [],
      sympathyTraits: [],
      statuses: [],
    },
  ],
  taskUses: {},
  completedFavors: {},
  purchasedUpgrades: [],
  favors: {},
  event: null,
  activeEventEffects: [],
  flags: {},
  lastTaskRoll: null,
  log: [
    "День 1: заказов и возможностей нет, агенты начинают в своих стартовых локациях.",
  ],
  };
}

export function loadStoredMode() {
  try {
    const storedMode = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    const storedPhaseMode = localStorage.getItem(EDITOR_MODE_PHASE_STORAGE_KEY);
    return storedMode === "edit" && storedPhaseMode === getPhaseMode() ? "edit" : "play";
  } catch {
    return "play";
  }
}

function sanitizeInteger(value, fallback) {
  const numericValue = Math.trunc(Number(value));
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function sanitizeSympathySectionCount(value, fallback) {
  const numericValue = Math.trunc(Number(value));
  let sectionCount = Number.isFinite(numericValue) ? Math.abs(numericValue) : fallback;
  sectionCount = Math.max(3, sectionCount);
  return sectionCount % 2 === 0 ? sectionCount + 1 : sectionCount;
}

const INTERFACE_THEME_IDS = new Set(["classic", "paper"]);

export const interfaceThemeOptions = [
  { value: "classic", label: "Прежний" },
  { value: "paper", label: "Бумажный" },
];

export function sanitizeInterfaceTheme(value) {
  return INTERFACE_THEME_IDS.has(value) ? value : defaultGameSettings.interfaceTheme;
}

export function normalizeSympathyGameSettings(source = {}) {
  let sympathyMin = sanitizeInteger(source.sympathyMin, defaultGameSettings.sympathyMin);
  let sympathyMax = sanitizeInteger(source.sympathyMax, defaultGameSettings.sympathyMax);

  if (sympathyMin === sympathyMax) {
    sympathyMin = defaultGameSettings.sympathyMin;
    sympathyMax = defaultGameSettings.sympathyMax;
  } else if (sympathyMin > sympathyMax) {
    [sympathyMin, sympathyMax] = [sympathyMax, sympathyMin];
  }

  const sympathyStart = Math.min(
    sympathyMax,
    Math.max(sympathyMin, sanitizeInteger(source.sympathyStart, defaultGameSettings.sympathyStart))
  );
  const sympathySections = sanitizeSympathySectionCount(source.sympathySections, defaultGameSettings.sympathySections);

  return {
    sympathyMin,
    sympathyMax,
    sympathyStart,
    sympathySections,
    mainCharacterSympathyEnabled: source.mainCharacterSympathyEnabled !== false,
  };
}

export function loadGameSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(GAME_SETTINGS_STORAGE_KEY) || "{}");
  } catch {
    stored = {};
  }

  return {
    ...sanitizeTaskMechanicSettings(stored),
    ...normalizeSympathyGameSettings(stored),
    interfaceTheme: sanitizeInterfaceTheme(stored.interfaceTheme),
    taskDifficultyLevels: normalizeTaskDifficultyLevels(stored.taskDifficultyLevels),
  };
}

export function loadPersistenceSettings() {
  const external = window.EDITOR_PERSISTENCE || {};
  const gitlab = external.gitlab || {};
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(PERSISTENCE_SETTINGS_STORAGE_KEY) || "{}");
  } catch {
    stored = {};
  }

  return {
    ...defaultPersistenceSettings,
    provider: external.provider || defaultPersistenceSettings.provider,
    localApiUrl: external.localApiUrl || defaultPersistenceSettings.localApiUrl,
    gitlabBaseUrl: gitlab.baseUrl || defaultPersistenceSettings.gitlabBaseUrl,
    gitlabProjectId: gitlab.projectId || defaultPersistenceSettings.gitlabProjectId,
    gitlabBranch: gitlab.branch || defaultPersistenceSettings.gitlabBranch,
    gitlabFilePath: gitlab.filePath || defaultPersistenceSettings.gitlabFilePath,
    ...stored,
  };
}

export const state = createInitialState();


export const editorState = {
  tab: "agents",
  entityViews: {
    agents: "list",
    traits: "list",
    upgrades: "list",
    events: "list",
    statuses: "list",
    activities: "list",
    zones: "list",
    paths: "list",
    locations: "list",
  },
  agentId: state.selectedAgentId,
  agentTraitMenuAgentId: "",
  traitId: "smart",
  upgradeId: "agent-recovery-1",
  eventId: "great-weather",
  statusId: "physical-training",
  activityId: "watch-series",
  zoneId: "bogateevo",
  pathId: "bog-park-bridge",
  locationId: state.selectedLocationId,
  taskLocationId: state.selectedLocationId,
  taskId: "",
  collapsed: false,
  createForms: {},
  createDrafts: {},
};

export const defaultPersistenceSettings = {
  provider: "auto",
  localApiUrl: "/api/editor-config",
  gitlabBaseUrl: "https://gitlab.bloodbar-game.org",
  gitlabProjectId: "bloodbar-game/bloodbar-agent-prototype",
  gitlabBranch: "main",
  gitlabFilePath: "data/editor",
};

export const defaultGameSettings = {
  ...DEFAULT_TASK_GAME_SETTINGS,
  taskDifficultyLevels: cloneTaskDifficultyLevels(),
  interfaceTheme: "classic",
  sympathyMin: -100,
  sympathyMax: 100,
  sympathyStart: 0,
  sympathySections: 7,
  mainCharacterSympathyEnabled: true,
};

export const taskMechanicOptions = TASK_MECHANIC_OPTIONS;
export const baseDieOptions = BASE_DIE_OPTIONS;
export const advantageDieOptions = ADVANTAGE_DIE_OPTIONS;

export let persistenceSettings = loadPersistenceSettings();

export let gameSettings = loadGameSettings();
export const runtime = {
  agentBlueprints: deepClone(state.agents),
  initialResources: deepClone(state.resources),
  barSettings: { ...DEFAULT_BAR_SETTINGS },
  appMode: loadStoredMode(),
  persistenceStatus: {
    provider: "не проверено",
    message: "Хранилище будет проверено при загрузке или сохранении.",
  },
  editorProfiles: createEditorProfileIndex(),
  deletedEditorProfileIds: [],
  editorHistory: {
    past: [],
    present: null,
    future: [],
    suppress: false,
  },
  inventoryPanelOpen: false,
  journalPanelOpen: false,
  upgradePanelOpen: false,
  barPanelOpen: false,
  settingsPanelOpen: false,
  agentProfileAgentId: "",
  nighttimeClientEditorId: "",
  settingsTab: "tasks",
  saveButtonResetTimer: 0,
  publishButtonResetTimer: 0,
  pathEndpointEditMode: false,
  activeMapDrag: null,
  zoneLabelDragZoneId: "",
  suppressMapClick: false,
};

export const pendingEditorChanges = new Map();

export const resourceDefs = RESOURCE_DEFINITIONS;

export const statDefs = {
  agility: { label: "ЛВК", full: "ловкость" },
  intelligence: { label: "ИНТ", full: "интеллект" },
  charisma: { label: "ХАР", full: "харизма" },
  none: { label: "БЕЗ СПЕЦ", full: "без специализации" },
};

export const mapViewport = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};
