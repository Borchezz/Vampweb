import { deepClone } from "./utils.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";
import { STANDARD_RESOURCE_ERROR_MESSAGE, STANDARD_RESOURCE_IDS, STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";

const COMMON_EFFECT_KEYS = ["type"];

export const EVENT_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const EVENT_RESOURCE_OPTIONS = STANDARD_RESOURCE_OPTIONS;

const EVENT_AGENT_PARAMETER_IDS = new Set(EVENT_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
const EVENT_RESOURCE_IDS = new Set(STANDARD_RESOURCE_IDS);
export const EVENT_EFFECT_FIELDS = {
  agentParameter: "agentParameter",
  number: "number",
  standardResource: "standardResource",
  status: "status",
  statusStacks: "statusStacks",
  path: "path",
};

export const EVENT_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр всех агентов",
    description: "Численно меняет параметр всех агентов: энергию, восстановление, симпатию, переработку или усталость.",
    fields: [
      { key: "parameter", label: "Параметр", input: "agentParameter", defaultParameter: "energy", options: EVENT_AGENT_PARAMETER_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "resource_delta",
    label: "Ресурс",
    description: "Численно меняет деньги, кровь или репутацию. Долг недоступен для этого эффекта.",
    fields: [
      { key: "resource", label: "Ресурс", input: "standardResource", defaultResource: "money", options: EVENT_RESOURCE_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "grant_status",
    label: "Получить статус",
    description: "Накладывает выбранный временный статус на всех агентов.",
    fields: [
      { key: "statusId", label: "Статус", input: "status", defaultStatus: "" },
      { key: "stacks", label: "Стаки", input: "statusStacks", default: 1, min: 1 },
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
  {
    type: "end_of_day_resource_set",
    label: "Ресурс в конце дня",
    description: "Устанавливает количество выбранного ресурса в конце дня.",
    fields: [
      { key: "resource", label: "Ресурс", input: "standardResource", defaultResource: "bloodTier1", options: EVENT_RESOURCE_OPTIONS },
      { key: "amount", label: "Количество", input: "number", default: 0, min: 0 },
    ],
  },
  {
    type: "disable_overtime",
    label: "Запрет переработки",
    description: "Не позволяет тратить энергию переработки до конца дня.",
    fields: [],
  },
];

export const EVENT_EFFECT_REGISTRY = Object.fromEntries(EVENT_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const EVENT_EFFECT_TYPES = EVENT_EFFECT_DEFINITIONS.map((definition) => definition.type);
export const EVENT_EFFECT_FIELD_KEYS = Object.fromEntries(
  EVENT_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_EFFECT_KEYS, ...definition.fields.map((field) => field.key)]])
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

function hasKnownRef(collection, value) {
  if (!value) return true;
  const keys = getObjectKeys(collection);
  return !keys.length || keys.includes(value);
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function getEventEffectDefinition(type) {
  return EVENT_EFFECT_REGISTRY[type] || null;
}

export function getEventEffectFieldDefinitions(type) {
  return getEventEffectDefinition(type)?.fields || [];
}

export function getEventEffectFieldDefinition(type, field) {
  return getEventEffectFieldDefinitions(type).find((fieldDefinition) => fieldDefinition.key === field) || null;
}

export function getEventEffectDescription(type) {
  return getEventEffectDefinition(type)?.description || "";
}

export function findEventEffectType(type) {
  const normalizedType = String(type || "").trim();
  return EVENT_EFFECT_TYPES.includes(normalizedType) ? normalizedType : "";
}

export function getDefaultEventEffectFieldValue(fieldDefinition, context = {}) {
  if (Object.prototype.hasOwnProperty.call(fieldDefinition, "default")) return fieldDefinition.default;
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.standardResource) {
    return getFirstAvailableKey(fieldDefinition.defaultResource, EVENT_RESOURCE_OPTIONS, "money");
  }
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.agentParameter) {
    return getFirstAvailableKey(fieldDefinition.defaultParameter, EVENT_AGENT_PARAMETER_OPTIONS, "energy");
  }
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.status) return getFirstAvailableKey(fieldDefinition.defaultStatus, context.statusEffects, "");
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.path) return getFirstAvailableKey(fieldDefinition.defaultPath, context.paths, "");
  return fieldDefinition.min || 0;
}

export function createDefaultEventEffect(type = "", context = {}) {
  const effectType = findEventEffectType(type) || EVENT_EFFECT_TYPES[0] || "";
  const effect = { type: effectType };
  getEventEffectFieldDefinitions(effectType).forEach((field) => {
    effect[field.key] = getDefaultEventEffectFieldValue(field, context);
  });
  return effect;
}

export function normalizeEventEffectFieldValue(fieldDefinition, value, context = {}) {
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.standardResource) {
    const resource = String(value || "").trim();
    return EVENT_RESOURCE_IDS.has(resource) ? resource : getDefaultEventEffectFieldValue(fieldDefinition);
  }
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.agentParameter) {
    const parameter = String(value || "").trim();
    return EVENT_AGENT_PARAMETER_IDS.has(parameter) ? parameter : getDefaultEventEffectFieldValue(fieldDefinition);
  }
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.status) return String(value || "").trim() || getDefaultEventEffectFieldValue(fieldDefinition, context);
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.path) return String(value || "").trim() || getDefaultEventEffectFieldValue(fieldDefinition, context);
  if (fieldDefinition.input === EVENT_EFFECT_FIELDS.statusStacks) return Math.max(1, Math.trunc(normalizeFiniteNumber(value, 1)));
  const fallback = getDefaultEventEffectFieldValue(fieldDefinition, context);
  return normalizeEffectNumber(value, fallback, { min: fieldDefinition.min });
}

export function normalizeEventEffect(effect, context = {}) {
  if (!isPlainObject(effect)) return null;
  const type = findEventEffectType(effect.type);
  if (!type) return null;

  const normalized = { type };
  getEventEffectFieldDefinitions(type).forEach((field) => {
    normalized[field.key] = normalizeEventEffectFieldValue(field, effect[field.key], context);
  });
  return normalized;
}

export function normalizeEventEffectList(effects, context = {}) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => normalizeEventEffect(deepClone(effect), context)).filter(Boolean);
}

export function collectEventEffectSchemaErrors(effect, context = "event effect", options = {}) {
  const errors = [];
  if (!isPlainObject(effect)) return [`${context} must be a plain object`];

  const type = findEventEffectType(effect.type);
  if (!type) return [`${context}.type must be a known event effect type`];

  const allowedKeys = new Set(EVENT_EFFECT_FIELD_KEYS[type]);
  Object.keys(effect).forEach((key) => {
    if (!allowedKeys.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });

  const resourceIds = new Set(getObjectKeys(options.resources || options.resourceDefs));
  const pathIds = new Set(getObjectKeys(options.paths));
  getEventEffectFieldDefinitions(type).forEach((field) => {
    const value = effect[field.key];
    if (field.input === EVENT_EFFECT_FIELDS.standardResource) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a resource id`);
      if (value && resourceIds.size && !resourceIds.has(value)) errors.push(`${context}.${field.key} references unknown resource: ${value}`);
      if (value && !EVENT_RESOURCE_IDS.has(value)) errors.push(`${context}.${field.key} ${STANDARD_RESOURCE_ERROR_MESSAGE}`);
    } else if (field.input === EVENT_EFFECT_FIELDS.agentParameter) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be an agent parameter`);
      if (value && !EVENT_AGENT_PARAMETER_IDS.has(value)) errors.push(`${context}.${field.key} must be energy, recovery, sympathy, overtime, or fatigue`);
    } else if (field.input === EVENT_EFFECT_FIELDS.status) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a status id`);
      if (value && !hasKnownRef(options.statusEffects, value)) errors.push(`${context}.${field.key} references unknown status: ${value}`);
    } else if (field.input === EVENT_EFFECT_FIELDS.statusStacks) {
      if (!Number.isInteger(value) || value < 1) errors.push(`${context}.${field.key} must be a positive integer`);
      const status = Array.isArray(options.statusEffects) ? options.statusEffects.find((item) => item.id === effect.statusId) : null;
      if (status && value > status.maxStacks) errors.push(`${context}.${field.key} exceeds status maxStacks: ${status.maxStacks}`);
    } else if (field.input === EVENT_EFFECT_FIELDS.path) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a path id`);
      if (value && pathIds.size && !pathIds.has(value)) errors.push(`${context}.${field.key} references unknown path: ${value}`);
    } else if (!isEffectNumber(value)) {
      errors.push(`${context}.${field.key} must be an integer or range`);
    }
  });

  return errors;
}

export function collectEventEffectListSchemaErrors(effects, context = "event effects", options = {}) {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectEventEffectSchemaErrors(effect, `${context}[${index}]`, options));
}
