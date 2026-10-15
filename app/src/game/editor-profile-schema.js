import {
  DEFAULT_EDITOR_PROFILE_ID,
  EDITOR_CONFIG_COLLECTIONS,
  EDITOR_CONFIG_FORMAT,
  EDITOR_CONFIG_VERSION,
  EDITOR_PROFILE_FORMAT,
  EDITOR_PROFILE_INDEX_VERSION,
  normalizeEditorProfileId,
} from "./editor-config-format.js";
import {
  collectAgentSchemaErrors,
  collectActivitySchemaErrors,
  collectEventSchemaErrors,
  collectLocationSchemaErrors,
  collectPathSchemaErrors,
  collectResourceMapErrors,
  collectStatusSchemaErrors,
  collectTaskSchemaErrors,
  collectTraitSchemaErrors,
  collectUpgradeSchemaErrors,
  collectZoneSchemaErrors,
} from "./content-schema.js";
import { collectContentGraphErrors } from "./content-graph.js";
import { TASK_DIFFICULTY_LEVEL_LIMITS } from "./task-difficulty-settings.js";
import { BAR_SETTING_METADATA } from "./bar-settings.js";

const PROFILE_INDEX_KEYS = ["version", "format", "activeProfileId", "profiles"];
const PROFILE_KEYS = ["id", "name", "mapBackground"];
const MAP_BACKGROUND_KEYS = ["name", "src"];
const PROFILE_SAVE_PAYLOAD_KEYS = ["version", "format", "activeProfileId", "profiles", "profileId", "config", "deletedProfileIds"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStableId(value) {
  return typeof value === "string" && value.trim() !== "" && normalizeEditorProfileId(value, "") === value;
}

function pushMissingObjectError(errors, context) {
  errors.push(`${context} must be a plain object`);
}

function collectUnexpectedKeyErrors(errors, context, value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });
}

function collectStringErrors(errors, context, value, options = {}) {
  if (typeof value !== "string") {
    errors.push(`${context} must be a string`);
    return;
  }
  if (!options.allowEmpty && value.trim() === "") errors.push(`${context} must not be empty`);
}

function collectStableIdErrors(errors, context, value) {
  collectStringErrors(errors, context, value);
  if (typeof value === "string" && value.trim() !== "" && !hasStableId(value)) {
    errors.push(`${context} must be a stable ascii slug`);
  }
}

function collectMapBackgroundErrors(errors, context, value) {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    pushMissingObjectError(errors, context);
    return;
  }

  collectUnexpectedKeyErrors(errors, context, value, MAP_BACKGROUND_KEYS);
  collectStringErrors(errors, `${context}.name`, value.name);
  collectStringErrors(errors, `${context}.src`, value.src);
}

function collectVersionErrors(errors, context, value, expected) {
  if (value !== expected) errors.push(`${context} must be ${expected}`);
}

function collectGameSettingsErrors(errors, context, value) {
  if (!isPlainObject(value)) {
    pushMissingObjectError(errors, context);
    return;
  }
  const allowedKeys = ["taskMechanic", "baseDie", "advantageDie", "interfaceTheme", "sympathyMin", "sympathyMax", "sympathyStart", "sympathySections", "mainCharacterSympathyEnabled", "taskDifficultyLevels"];
  collectUnexpectedKeyErrors(errors, context, value, allowedKeys);
  if (!Array.isArray(value.taskDifficultyLevels)) {
    errors.push(`${context}.taskDifficultyLevels must be an array`);
    return;
  }
  if (value.taskDifficultyLevels.length < TASK_DIFFICULTY_LEVEL_LIMITS.min || value.taskDifficultyLevels.length > TASK_DIFFICULTY_LEVEL_LIMITS.max) {
    errors.push(`${context}.taskDifficultyLevels must contain between ${TASK_DIFFICULTY_LEVEL_LIMITS.min} and ${TASK_DIFFICULTY_LEVEL_LIMITS.max} levels`);
  }
  const ids = new Set();
  value.taskDifficultyLevels.forEach((level, index) => {
    const levelContext = `${context}.taskDifficultyLevels[${index}]`;
    if (!isPlainObject(level)) {
      pushMissingObjectError(errors, levelContext);
      return;
    }
    collectUnexpectedKeyErrors(errors, levelContext, level, ["id", "name", "value"]);
    collectStableIdErrors(errors, `${levelContext}.id`, level.id);
    collectStringErrors(errors, `${levelContext}.name`, level.name);
    if (!Number.isFinite(Number(level.value))) errors.push(`${levelContext}.value must be a finite number`);
    if (ids.has(level.id)) errors.push(`${levelContext}.id duplicates difficulty id: ${level.id}`);
    ids.add(level.id);
  });
}

function collectBarSettingsErrors(errors, context, value) {
  if (!isPlainObject(value)) {
    pushMissingObjectError(errors, context);
    return;
  }
  const allowedKeys = BAR_SETTING_METADATA.map((setting) => setting.field);
  collectUnexpectedKeyErrors(errors, context, value, allowedKeys);
  BAR_SETTING_METADATA.forEach((setting) => {
    if (!Number.isFinite(Number(value[setting.field]))) errors.push(`${context}.${setting.field} must be a finite number`);
  });
}

function collectFormatErrors(errors, context, value, expected) {
  if (value !== expected) errors.push(`${context} must be ${expected}`);
}

export function collectEditorConfigManifestErrors(manifest, context = "editor config manifest") {
  const errors = [];
  if (!isPlainObject(manifest)) {
    pushMissingObjectError(errors, context);
    return errors;
  }

  collectUnexpectedKeyErrors(errors, context, manifest, ["version", "format", "collections"]);
  collectVersionErrors(errors, `${context}.version`, manifest.version, EDITOR_CONFIG_VERSION);
  collectFormatErrors(errors, `${context}.format`, manifest.format, EDITOR_CONFIG_FORMAT);

  if (!isPlainObject(manifest.collections)) {
    errors.push(`${context}.collections must be a plain object`);
    return errors;
  }

  const expectedCollections = Object.fromEntries(EDITOR_CONFIG_COLLECTIONS.map((collection) => [collection.key, collection.file]));
  collectUnexpectedKeyErrors(errors, `${context}.collections`, manifest.collections, Object.keys(expectedCollections));
  Object.entries(expectedCollections).forEach(([key, file]) => {
    if (manifest.collections[key] !== file) errors.push(`${context}.collections.${key} must be ${file}`);
  });

  return errors;
}

export function collectEditorProfileIndexErrors(profileIndex, context = "editor profile index") {
  const errors = [];
  if (!isPlainObject(profileIndex)) {
    pushMissingObjectError(errors, context);
    return errors;
  }

  collectUnexpectedKeyErrors(errors, context, profileIndex, PROFILE_INDEX_KEYS);
  collectVersionErrors(errors, `${context}.version`, profileIndex.version, EDITOR_PROFILE_INDEX_VERSION);
  collectFormatErrors(errors, `${context}.format`, profileIndex.format, EDITOR_PROFILE_FORMAT);
  collectStableIdErrors(errors, `${context}.activeProfileId`, profileIndex.activeProfileId);

  if (!Array.isArray(profileIndex.profiles)) {
    errors.push(`${context}.profiles must be an array`);
    return errors;
  }
  if (!profileIndex.profiles.length) errors.push(`${context}.profiles must contain at least one profile`);

  const profileIds = new Set();
  profileIndex.profiles.forEach((profile, index) => {
    const profileContext = `${context}.profiles[${index}]`;
    if (!isPlainObject(profile)) {
      pushMissingObjectError(errors, profileContext);
      return;
    }

    collectUnexpectedKeyErrors(errors, profileContext, profile, PROFILE_KEYS);
    collectStableIdErrors(errors, `${profileContext}.id`, profile.id);
    collectStringErrors(errors, `${profileContext}.name`, profile.name);
    collectMapBackgroundErrors(errors, `${profileContext}.mapBackground`, profile.mapBackground);
    if (typeof profile.id === "string" && profile.id.trim()) {
      if (profileIds.has(profile.id)) errors.push(`${profileContext}.id duplicates profile id: ${profile.id}`);
      profileIds.add(profile.id);
    }
  });

  if (!profileIds.has(DEFAULT_EDITOR_PROFILE_ID)) errors.push(`${context}.profiles must include ${DEFAULT_EDITOR_PROFILE_ID}`);
  if (typeof profileIndex.activeProfileId === "string" && profileIndex.activeProfileId.trim() && !profileIds.has(profileIndex.activeProfileId)) {
    errors.push(`${context}.activeProfileId must reference an existing profile`);
  }

  return errors;
}

export function collectEditorConfigContractErrors(config, context = "editor config", options = {}) {
  const errors = [];
  if (!isPlainObject(config)) {
    pushMissingObjectError(errors, context);
    return errors;
  }

  const allowedKeys = ["version", ...EDITOR_CONFIG_COLLECTIONS.map((collection) => collection.key)];
  collectUnexpectedKeyErrors(errors, context, config, allowedKeys);
  collectVersionErrors(errors, `${context}.version`, config.version, EDITOR_CONFIG_VERSION);

  EDITOR_CONFIG_COLLECTIONS.forEach((collection) => {
    const value = config[collection.key];
    const fieldContext = `${context}.${collection.key}`;
    if (collection.key === "gameSettings") {
      collectGameSettingsErrors(errors, fieldContext, value);
      return;
    }
    if (collection.key === "initialResources") {
      errors.push(...collectResourceMapErrors(value, fieldContext));
      return;
    }
    if (collection.key === "barSettings") {
      collectBarSettingsErrors(errors, fieldContext, value);
      return;
    }
    if (collection.key === "traits" && value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`${fieldContext} must be an array`);
      return;
    }

    value.forEach((item, index) => {
      const itemContext = `${fieldContext}[${index}]`;
      if (collection.key === "agents") errors.push(...collectAgentSchemaErrors(item, itemContext));
      const effectOptions = { statusEffects: config.statusEffects, paths: config.paths };
      if (collection.key === "traits") errors.push(...collectTraitSchemaErrors(item, itemContext, effectOptions));
      if (collection.key === "upgrades") errors.push(...collectUpgradeSchemaErrors(item, itemContext, effectOptions));
      if (collection.key === "events") errors.push(...collectEventSchemaErrors(item, itemContext, effectOptions));
      if (collection.key === "statusEffects") errors.push(...collectStatusSchemaErrors(item, itemContext));
      if (collection.key === "activities") errors.push(...collectActivitySchemaErrors(item, itemContext, effectOptions));
      if (collection.key === "zones") errors.push(...collectZoneSchemaErrors(item, itemContext));
      if (collection.key === "paths") errors.push(...collectPathSchemaErrors(item, itemContext));
      if (collection.key === "locations") errors.push(...collectLocationSchemaErrors(item, itemContext));
      if (collection.key === "tasks") errors.push(...collectTaskSchemaErrors(item, itemContext, effectOptions));
    });
  });

  if (Array.isArray(config.agents) && config.agents.filter((agent) => agent?.isMainCharacter).length > 1) {
    errors.push(`${context}.agents must contain at most one main character`);
  }

  if (options.validateGraph) {
    errors.push(...collectContentGraphErrors(config, { ...options, context }));
  }

  return errors;
}

export function collectEditorProfileSavePayloadErrors(payload, context = "editor profile save payload", options = {}) {
  const errors = [];
  if (!isPlainObject(payload)) {
    pushMissingObjectError(errors, context);
    return errors;
  }

  collectUnexpectedKeyErrors(errors, context, payload, PROFILE_SAVE_PAYLOAD_KEYS);
  const profileIndexErrors = collectEditorProfileIndexErrors(
    {
      version: payload.version,
      format: payload.format,
      activeProfileId: payload.activeProfileId,
      profiles: payload.profiles,
    },
    context
  );
  errors.push(...profileIndexErrors);
  const profileIds = new Set(Array.isArray(payload.profiles) ? payload.profiles.map((profile) => profile?.id).filter(Boolean) : []);

  collectStableIdErrors(errors, `${context}.profileId`, payload.profileId);
  if (profileIds.size && !profileIds.has(payload.profileId)) {
    errors.push(`${context}.profileId must reference a profile from ${context}.profiles`);
  }
  if (payload.profileId !== payload.activeProfileId) {
    errors.push(`${context}.profileId must equal ${context}.activeProfileId`);
  }
  errors.push(...collectEditorConfigContractErrors(payload.config, `${context}.config`, options));

  if (!Array.isArray(payload.deletedProfileIds)) {
    errors.push(`${context}.deletedProfileIds must be an array`);
  } else {
    payload.deletedProfileIds.forEach((profileId, index) => {
      collectStableIdErrors(errors, `${context}.deletedProfileIds[${index}]`, profileId);
      if (profileId === DEFAULT_EDITOR_PROFILE_ID) {
        errors.push(`${context}.deletedProfileIds[${index}] must not delete the default profile`);
      }
      if (profileId === payload.activeProfileId) {
        errors.push(`${context}.deletedProfileIds[${index}] must not delete the active profile`);
      }
      if (profileIds.has(profileId)) {
        errors.push(`${context}.deletedProfileIds[${index}] must not still exist in ${context}.profiles`);
      }
    });
  }

  return errors;
}
