import { deepClone } from "./utils.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";

const COMMON_KEYS = ["type"];

export const STATUS_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const STATUS_CHECK_SCOPE_OPTIONS = [
  { value: "physical", label: "Физические (ловкость)" },
  { value: "social", label: "Социальные (харизма)" },
  { value: "mental", label: "Ментальные (интеллект)" },
  { value: "any", label: "Любые" },
];

export const STATUS_SPECIALTY_OPTIONS = [
  { value: "agility", label: "Ловкость" },
  { value: "intelligence", label: "Интеллект" },
  { value: "charisma", label: "Харизма" },
];

const PARAMETERS = new Set(STATUS_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
const SCOPES = new Set(STATUS_CHECK_SCOPE_OPTIONS.map((option) => option.value));
const SPECIALTIES = new Set(STATUS_SPECIALTY_OPTIONS.map((option) => option.value));

export const STATUS_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр агента",
    description: "Численно меняет параметр агента. При стеках значения суммируются.",
    fields: [
      { key: "parameter", label: "Параметр", input: "select", options: STATUS_AGENT_PARAMETER_OPTIONS, default: "energy" },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "sympathy_gain_percent",
    label: "Получаемая симпатия",
    description: "Процентно меняет положительное получение симпатии. При стеках проценты суммируются.",
    fields: [{ key: "percent", label: "Процент", input: "number", default: 0 }],
  },
  {
    type: "specialization",
    label: "Временная специализация",
    description: "Временно добавляет специализацию для соответствующих проверок.",
    fields: [{ key: "stat", label: "Специализация", input: "select", options: STATUS_SPECIALTY_OPTIONS, default: "agility" }],
  },
  {
    type: "movement_cost_percent",
    label: "Стоимость перемещения",
    description: "Процентно меняет энергетическую стоимость перемещения. При стеках проценты суммируются.",
    fields: [{ key: "percent", label: "Процент", input: "number", default: 0 }],
  },
  {
    type: "overtime_sympathy_cost_percent",
    label: "Стоимость переработки",
    description: "Процентно меняет цену переработки в симпатии. При стеках проценты суммируются.",
    fields: [{ key: "percent", label: "Процент", input: "number", default: 0 }],
  },
  {
    type: "check_advantage",
    label: "Преимущество в проверках",
    description: "Даёт преимущество при выбранных проверках. При стеках даёт по одному преимуществу за стак.",
    fields: [{ key: "scope", label: "Проверки", input: "select", options: STATUS_CHECK_SCOPE_OPTIONS, default: "any" }],
  },
  {
    type: "check_penalty",
    label: "Штраф в проверках",
    description: "Даёт штраф при выбранных проверках. При стеках даёт по одному штрафу за стак.",
    fields: [{ key: "scope", label: "Проверки", input: "select", options: STATUS_CHECK_SCOPE_OPTIONS, default: "any" }],
  },
  {
    type: "temporary_check_advantage",
    label: "Временное преимущество",
    description: "Даёт преимущество при выбранной проверке и тратит один стак статуса.",
    fields: [{ key: "scope", label: "Проверки", input: "select", options: STATUS_CHECK_SCOPE_OPTIONS, default: "any" }],
  },
  {
    type: "temporary_check_penalty",
    label: "Временный штраф",
    description: "Даёт штраф при выбранной проверке и тратит один стак статуса.",
    fields: [{ key: "scope", label: "Проверки", input: "select", options: STATUS_CHECK_SCOPE_OPTIONS, default: "any" }],
  },
];

export const STATUS_EFFECT_REGISTRY = Object.fromEntries(STATUS_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const STATUS_EFFECT_TYPES = STATUS_EFFECT_DEFINITIONS.map((definition) => definition.type);
export const STATUS_EFFECT_FIELD_KEYS = Object.fromEntries(
  STATUS_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_KEYS, ...definition.fields.map((field) => field.key)]])
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getStatusEffectDefinition(type) {
  return STATUS_EFFECT_REGISTRY[type] || null;
}

export function getStatusEffectFieldDefinitions(type) {
  return getStatusEffectDefinition(type)?.fields || [];
}

export function getStatusEffectFieldDefinition(type, field) {
  return getStatusEffectFieldDefinitions(type).find((definition) => definition.key === field) || null;
}

export function getStatusEffectDescription(type) {
  return getStatusEffectDefinition(type)?.description || "";
}

function knownType(type) {
  const value = String(type || "").trim();
  return STATUS_EFFECT_TYPES.includes(value) ? value : "";
}

export function createDefaultStatusEffect(type = "") {
  const safeType = knownType(type) || STATUS_EFFECT_TYPES[0];
  const effect = { type: safeType };
  getStatusEffectFieldDefinitions(safeType).forEach((field) => {
    effect[field.key] = field.default ?? 0;
  });
  return effect;
}

export function normalizeStatusEffectFieldValue(field, value) {
  if (field.key === "parameter") return PARAMETERS.has(value) ? value : field.default;
  if (field.key === "scope") return SCOPES.has(value) ? value : field.default;
  if (field.key === "stat") return SPECIALTIES.has(value) ? value : field.default;
  return normalizeEffectNumber(value, field.default ?? 0, { min: field.min });
}

export function normalizeStatusEffect(effect) {
  if (!isPlainObject(effect)) return null;
  const type = knownType(effect.type);
  if (!type) return null;
  const normalized = { type };
  getStatusEffectFieldDefinitions(type).forEach((field) => {
    normalized[field.key] = normalizeStatusEffectFieldValue(field, effect[field.key]);
  });
  return normalized;
}

export function normalizeStatusEffectList(effects) {
  return Array.isArray(effects) ? effects.map((effect) => normalizeStatusEffect(deepClone(effect))).filter(Boolean) : [];
}

export function collectStatusEffectSchemaErrors(effect, context = "status effect") {
  if (!isPlainObject(effect)) return [`${context} must be a plain object`];
  const type = knownType(effect.type);
  if (!type) return [`${context}.type must be a known status effect type`];
  const errors = [];
  const allowed = new Set(STATUS_EFFECT_FIELD_KEYS[type]);
  Object.keys(effect).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });
  getStatusEffectFieldDefinitions(type).forEach((field) => {
    const value = effect[field.key];
    if (field.key === "parameter" && !PARAMETERS.has(value)) errors.push(`${context}.parameter must be a known agent parameter`);
    else if (field.key === "scope" && !SCOPES.has(value)) errors.push(`${context}.scope must be physical, social, mental, or any`);
    else if (field.key === "stat" && !SPECIALTIES.has(value)) errors.push(`${context}.stat must be agility, intelligence, or charisma`);
    else if (["amount", "percent"].includes(field.key) && !isEffectNumber(value)) errors.push(`${context}.${field.key} must be an integer or range`);
  });
  return errors;
}

export function collectStatusEffectListSchemaErrors(effects, context = "status effects") {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectStatusEffectSchemaErrors(effect, `${context}[${index}]`));
}
