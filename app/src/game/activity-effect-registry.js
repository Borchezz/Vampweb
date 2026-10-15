import { deepClone } from "./utils.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";
import { STANDARD_RESOURCE_ERROR_MESSAGE, STANDARD_RESOURCE_IDS, STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";

const COMMON_EFFECT_KEYS = ["type"];

export const ACTIVITY_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const ACTIVITY_AGENT_TARGET_OPTIONS = [
  { value: "main", label: "Агент-гг" },
  { value: "partner", label: "Напарник" },
  { value: "all", label: "Все агенты" },
];

export const ACTIVITY_RESOURCE_OPTIONS = STANDARD_RESOURCE_OPTIONS;

const PARAMETER_IDS = new Set(ACTIVITY_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
const TARGET_IDS = new Set(ACTIVITY_AGENT_TARGET_OPTIONS.map((option) => option.value));
const RESOURCE_IDS = new Set(STANDARD_RESOURCE_IDS);

export const ACTIVITY_EFFECT_FIELDS = {
  agentParameter: "agentParameter",
  agentTarget: "agentTarget",
  number: "number",
  standardResource: "standardResource",
  status: "status",
  statusStacks: "statusStacks",
};

export const ACTIVITY_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр агента",
    description: "Численно меняет параметр выбранного участника: энергию, восстановление, симпатию, переработку или усталость.",
    fields: [
      { key: "target", label: "Кому", input: "agentTarget", defaultTarget: "main", options: ACTIVITY_AGENT_TARGET_OPTIONS },
      { key: "parameter", label: "Параметр", input: "agentParameter", defaultParameter: "energy", options: ACTIVITY_AGENT_PARAMETER_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "resource_delta",
    label: "Ресурс",
    description: "Численно меняет деньги, кровь или репутацию. Долг недоступен.",
    fields: [
      { key: "resource", label: "Ресурс", input: "standardResource", defaultResource: "money", options: ACTIVITY_RESOURCE_OPTIONS },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "grant_status",
    label: "Получить статус",
    description: "Накладывает выбранный временный статус на участников активности.",
    fields: [
      { key: "target", label: "Кому", input: "agentTarget", defaultTarget: "main", options: ACTIVITY_AGENT_TARGET_OPTIONS },
      { key: "statusId", label: "Статус", input: "status", defaultStatus: "" },
      { key: "stacks", label: "Стаки", input: "statusStacks", default: 1, min: 1 },
    ],
  },
];

export const ACTIVITY_EFFECT_REGISTRY = Object.fromEntries(ACTIVITY_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const ACTIVITY_EFFECT_TYPES = ACTIVITY_EFFECT_DEFINITIONS.map((definition) => definition.type);
export const ACTIVITY_EFFECT_FIELD_KEYS = Object.fromEntries(
  ACTIVITY_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_EFFECT_KEYS, ...definition.fields.map((field) => field.key)]])
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function getActivityEffectDefinition(type) {
  return ACTIVITY_EFFECT_REGISTRY[type] || null;
}

export function getActivityEffectFieldDefinitions(type) {
  return getActivityEffectDefinition(type)?.fields || [];
}

export function getActivityEffectFieldDefinition(type, field) {
  return getActivityEffectFieldDefinitions(type).find((fieldDefinition) => fieldDefinition.key === field) || null;
}

export function getActivityEffectDescription(type) {
  return getActivityEffectDefinition(type)?.description || "";
}

export function findActivityEffectType(type) {
  const normalizedType = String(type || "").trim();
  return ACTIVITY_EFFECT_TYPES.includes(normalizedType) ? normalizedType : "";
}

export function getDefaultActivityEffectFieldValue(fieldDefinition, context = {}) {
  if (Object.prototype.hasOwnProperty.call(fieldDefinition, "default")) return fieldDefinition.default;
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.standardResource) return fieldDefinition.defaultResource || "money";
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.agentParameter) return fieldDefinition.defaultParameter || "energy";
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.agentTarget) return fieldDefinition.defaultTarget || "main";
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.status) return String(fieldDefinition.defaultStatus || context.statusEffects?.[0]?.id || "");
  return fieldDefinition.min || 0;
}

export function createDefaultActivityEffect(type = "", context = {}) {
  const effectType = findActivityEffectType(type) || ACTIVITY_EFFECT_TYPES[0] || "";
  const effect = { type: effectType };
  getActivityEffectFieldDefinitions(effectType).forEach((field) => {
    effect[field.key] = getDefaultActivityEffectFieldValue(field, context);
  });
  return effect;
}

export function normalizeActivityEffectFieldValue(fieldDefinition, value, context = {}) {
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.standardResource) {
    const resource = String(value || "").trim();
    return RESOURCE_IDS.has(resource) ? resource : getDefaultActivityEffectFieldValue(fieldDefinition);
  }
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.agentParameter) {
    const parameter = String(value || "").trim();
    return PARAMETER_IDS.has(parameter) ? parameter : getDefaultActivityEffectFieldValue(fieldDefinition);
  }
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.agentTarget) {
    const target = String(value || "").trim();
    return TARGET_IDS.has(target) ? target : getDefaultActivityEffectFieldValue(fieldDefinition);
  }
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.status) return String(value || "").trim() || getDefaultActivityEffectFieldValue(fieldDefinition, context);
  if (fieldDefinition.input === ACTIVITY_EFFECT_FIELDS.statusStacks) return Math.max(1, Math.trunc(normalizeFiniteNumber(value, 1)));
  return normalizeEffectNumber(value, getDefaultActivityEffectFieldValue(fieldDefinition, context), { min: fieldDefinition.min });
}

export function normalizeActivityEffect(effect, context = {}) {
  if (!isPlainObject(effect)) return null;
  const type = findActivityEffectType(effect.type);
  if (!type) return null;
  const normalized = { type };
  getActivityEffectFieldDefinitions(type).forEach((field) => {
    normalized[field.key] = normalizeActivityEffectFieldValue(field, effect[field.key], context);
  });
  return normalized;
}

export function normalizeActivityEffectList(effects, context = {}) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => normalizeActivityEffect(deepClone(effect), context)).filter(Boolean);
}

export function collectActivityEffectSchemaErrors(effect, context = "activity effect", options = {}) {
  const errors = [];
  if (!isPlainObject(effect)) return [`${context} must be a plain object`];
  const type = findActivityEffectType(effect.type);
  if (!type) return [`${context}.type must be a known activity effect type`];
  const allowedKeys = new Set(ACTIVITY_EFFECT_FIELD_KEYS[type]);
  Object.keys(effect).forEach((key) => {
    if (!allowedKeys.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });
  const resourceIds = new Set(Array.isArray(options.resources) ? options.resources.map((item) => item.id || item) : Object.keys(options.resources || options.resourceDefs || {}));
  getActivityEffectFieldDefinitions(type).forEach((field) => {
    const value = effect[field.key];
    if (field.input === ACTIVITY_EFFECT_FIELDS.standardResource) {
      if (typeof value !== "string" || !RESOURCE_IDS.has(value)) errors.push(`${context}.${field.key} ${STANDARD_RESOURCE_ERROR_MESSAGE}`);
      else if (resourceIds.size && !resourceIds.has(value)) errors.push(`${context}.${field.key} references unknown resource: ${value}`);
    } else if (field.input === ACTIVITY_EFFECT_FIELDS.agentParameter) {
      if (typeof value !== "string" || !PARAMETER_IDS.has(value)) errors.push(`${context}.${field.key} must be energy, recovery, sympathy, overtime, or fatigue`);
    } else if (field.input === ACTIVITY_EFFECT_FIELDS.agentTarget) {
      if (typeof value !== "string" || !TARGET_IDS.has(value)) errors.push(`${context}.${field.key} must be main, partner, or all`);
    } else if (field.input === ACTIVITY_EFFECT_FIELDS.status) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a status id`);
    } else if (field.input === ACTIVITY_EFFECT_FIELDS.statusStacks) {
      if (!Number.isInteger(value) || value < 1) errors.push(`${context}.${field.key} must be a positive integer`);
      const status = Array.isArray(options.statusEffects) ? options.statusEffects.find((item) => item.id === effect.statusId) : null;
      if (status && value > status.maxStacks) errors.push(`${context}.${field.key} exceeds status maxStacks: ${status.maxStacks}`);
    } else if (!isEffectNumber(value)) {
      errors.push(`${context}.${field.key} must be an integer or range`);
    }
  });
  return errors;
}

export function collectActivityEffectListSchemaErrors(effects, context = "activity effects", options = {}) {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectActivityEffectSchemaErrors(effect, `${context}[${index}]`, options));
}
