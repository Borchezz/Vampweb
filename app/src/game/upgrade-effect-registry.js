import { STANDARD_RESOURCE_ERROR_MESSAGE, STANDARD_RESOURCE_IDS, STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";

const COMMON_EFFECT_KEYS = ["type"];

export const UPGRADE_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const UPGRADE_RESOURCE_OPTIONS = STANDARD_RESOURCE_OPTIONS;

const UPGRADE_AGENT_PARAMETER_IDS = new Set(UPGRADE_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
const UPGRADE_RESOURCE_IDS = new Set(STANDARD_RESOURCE_IDS);

export const UPGRADE_EFFECT_FIELDS = {
  agentParameter: "agentParameter",
  number: "number",
  standardResource: "standardResource",
  path: "path",
};

export const UPGRADE_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр агента",
    description: "Численно меняет параметр выбранного агента: энергию, восстановление, симпатию, переработку или усталость.",
    fields: [
      { key: "parameter", label: "Параметр", input: "agentParameter", defaultParameter: "energy", options: UPGRADE_AGENT_PARAMETER_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "agent_parameter_set",
    label: "Установить параметр агента",
    description: "Устанавливает параметр выбранного агента в конкретное числовое значение.",
    fields: [
      { key: "parameter", label: "Параметр", input: "agentParameter", defaultParameter: "sympathy", options: UPGRADE_AGENT_PARAMETER_OPTIONS },
      { key: "value", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "resource_delta",
    label: "Ресурс",
    description: "Численно меняет деньги, кровь или репутацию. Долг недоступен для этого эффекта.",
    fields: [
      { key: "resource", label: "Ресурс", input: "standardResource", defaultResource: "money", options: UPGRADE_RESOURCE_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "enable_path",
    label: "Включить путь",
    description: "Открывает выбранный путь для перемещения.",
    fields: [{ key: "pathId", label: "Путь", input: "path", defaultPath: "" }],
  },
  {
    type: "disable_path",
    label: "Отключить путь",
    description: "Закрывает выбранный путь для перемещения.",
    fields: [{ key: "pathId", label: "Путь", input: "path", defaultPath: "" }],
  },
  {
    type: "path_energy_delta",
    label: "Стоимость пути",
    description: "Изменяет энергетическую стоимость выбранного пути. Отрицательное значение удешевляет путь.",
    fields: [
      { key: "pathId", label: "Путь", input: "path", defaultPath: "" },
      { key: "amount", label: "Энергия", input: "number", default: 0 },
    ],
  },
];

export const UPGRADE_EFFECT_REGISTRY = Object.fromEntries(UPGRADE_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const UPGRADE_EFFECT_TYPES = UPGRADE_EFFECT_DEFINITIONS.map((definition) => definition.type);
export const UPGRADE_EFFECT_FIELD_KEYS = Object.fromEntries(
  UPGRADE_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_EFFECT_KEYS, ...definition.fields.map((field) => field.key)]])
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getObjectKeys(value) {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value.map((item) => (item && typeof item === "object" ? item.id || item.value : item)).filter(Boolean);
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function getFirstAvailableKey(preferredKey, collection, fallbackKey = "") {
  const keys = getObjectKeys(collection);
  if (preferredKey && keys.includes(preferredKey)) return preferredKey;
  if (fallbackKey && keys.includes(fallbackKey)) return fallbackKey;
  return keys[0] || "";
}

export function getUpgradeEffectDefinition(type) {
  return UPGRADE_EFFECT_REGISTRY[type] || null;
}

export function getUpgradeEffectFieldDefinitions(type) {
  return getUpgradeEffectDefinition(type)?.fields || [];
}

export function getUpgradeEffectFieldDefinition(type, field) {
  return getUpgradeEffectFieldDefinitions(type).find((fieldDefinition) => fieldDefinition.key === field) || null;
}

export function getUpgradeEffectDescription(type) {
  return getUpgradeEffectDefinition(type)?.description || "";
}

export function findUpgradeEffectType(type) {
  const normalizedType = String(type || "").trim();
  return UPGRADE_EFFECT_TYPES.includes(normalizedType) ? normalizedType : "";
}

export function getDefaultUpgradeEffectFieldValue(fieldDefinition, context = {}) {
  if (Object.prototype.hasOwnProperty.call(fieldDefinition, "default")) return fieldDefinition.default;
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.agentParameter) {
    return getFirstAvailableKey(fieldDefinition.defaultParameter, UPGRADE_AGENT_PARAMETER_OPTIONS, "energy");
  }
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.standardResource) {
    return getFirstAvailableKey(fieldDefinition.defaultResource, UPGRADE_RESOURCE_OPTIONS, "money");
  }
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.path) return getFirstAvailableKey(fieldDefinition.defaultPath, context.paths, "");
  return fieldDefinition.min || 0;
}

export function createDefaultUpgradeEffect(type = "", context = {}) {
  const effectType = findUpgradeEffectType(type) || UPGRADE_EFFECT_TYPES[0] || "";
  const effect = { type: effectType };
  getUpgradeEffectFieldDefinitions(effectType).forEach((field) => {
    effect[field.key] = getDefaultUpgradeEffectFieldValue(field, context);
  });
  return effect;
}

export function normalizeUpgradeEffectFieldValue(fieldDefinition, value, context = {}) {
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.agentParameter) {
    const parameter = String(value || "").trim();
    return UPGRADE_AGENT_PARAMETER_IDS.has(parameter) ? parameter : getDefaultUpgradeEffectFieldValue(fieldDefinition, context);
  }
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.standardResource) {
    const resource = String(value || "").trim();
    return UPGRADE_RESOURCE_IDS.has(resource) ? resource : getDefaultUpgradeEffectFieldValue(fieldDefinition, context);
  }
  if (fieldDefinition.input === UPGRADE_EFFECT_FIELDS.path) return String(value || "").trim() || getDefaultUpgradeEffectFieldValue(fieldDefinition, context);
  const fallback = getDefaultUpgradeEffectFieldValue(fieldDefinition, context);
  return normalizeEffectNumber(value, fallback, { min: fieldDefinition.min });
}

export function normalizeUpgradeEffect(effect, context = {}) {
  if (!isPlainObject(effect)) return null;
  const type = findUpgradeEffectType(effect.type);
  if (!type) return null;

  const normalized = { type };
  getUpgradeEffectFieldDefinitions(type).forEach((field) => {
    normalized[field.key] = normalizeUpgradeEffectFieldValue(field, effect[field.key], context);
  });
  return normalized;
}

export function normalizeUpgradeEffectList(effects, context = {}) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => normalizeUpgradeEffect(effect, context)).filter(Boolean);
}

export function collectUpgradeEffectSchemaErrors(effect, context = "upgrade effect", options = {}) {
  const errors = [];
  if (!isPlainObject(effect)) return [`${context} must be a plain object`];

  const type = findUpgradeEffectType(effect.type);
  if (!type) return [`${context}.type must be a known upgrade effect type`];

  const allowedKeys = new Set(UPGRADE_EFFECT_FIELD_KEYS[type]);
  Object.keys(effect).forEach((key) => {
    if (!allowedKeys.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });

  const resourceIds = new Set(getObjectKeys(options.resources || options.resourceDefs));
  const pathIds = new Set(getObjectKeys(options.paths));
  getUpgradeEffectFieldDefinitions(type).forEach((field) => {
    const value = effect[field.key];
    if (field.input === UPGRADE_EFFECT_FIELDS.agentParameter) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be an agent parameter`);
      if (value && !UPGRADE_AGENT_PARAMETER_IDS.has(value)) errors.push(`${context}.${field.key} must be energy, recovery, sympathy, overtime, or fatigue`);
    } else if (field.input === UPGRADE_EFFECT_FIELDS.standardResource) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a resource id`);
      if (value && resourceIds.size && !resourceIds.has(value)) errors.push(`${context}.${field.key} references unknown resource: ${value}`);
      if (value && !UPGRADE_RESOURCE_IDS.has(value)) errors.push(`${context}.${field.key} ${STANDARD_RESOURCE_ERROR_MESSAGE}`);
    } else if (field.input === UPGRADE_EFFECT_FIELDS.path) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a path id`);
      if (value && pathIds.size && !pathIds.has(value)) errors.push(`${context}.${field.key} references unknown path: ${value}`);
    } else if (!isEffectNumber(value)) {
      errors.push(`${context}.${field.key} must be an integer or range`);
    }
  });

  return errors;
}

export function collectUpgradeEffectListSchemaErrors(effects, context = "upgrade effects", options = {}) {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectUpgradeEffectSchemaErrors(effect, `${context}[${index}]`, options));
}
