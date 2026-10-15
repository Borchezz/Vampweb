import { normalizeEffectNumber } from "./effect-value.js";

const COMMON_EFFECT_KEYS = ["type"];

export const TRAIT_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const TRAIT_EFFECT_FIELD_INPUTS = {
  agentParameter: "agentParameter",
  number: "number",
  resource: "resource",
  stat: "stat",
  status: "status",
  path: "path",
};

export const TRAIT_EFFECT_FIELD_VALIDATORS = {
  agentParameterRef: "agentParameterRef",
  finiteNumber: "finiteNumber",
  positiveInteger: "positiveInteger",
  resourceRef: "resourceRef",
  statRef: "statRef",
  statusRef: "statusRef",
  pathRef: "pathRef",
};

export const TRAIT_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр агента",
    description: "Численно меняет базовый параметр агента: энергию, восстановление, симпатию, энергию переработки или усталость.",
    fields: [
      { key: "parameter", label: "Параметр", input: "agentParameter", validator: "agentParameterRef", defaultParameter: "energy" },
      { key: "amount", label: "Значение", input: "number", validator: "finiteNumber", default: 0 },
    ],
  },
  {
    type: "sympathy_gain_percent",
    label: "Получаемая симпатия",
    description: "Процентно меняет только положительные приросты симпатии. 50 = на 50% больше, -50 = вдвое меньше.",
    fields: [{ key: "percent", label: "Процент", input: "number", validator: "finiteNumber", default: 0 }],
  },
  {
    type: "upkeep_cost",
    label: "Стоимость содержания",
    description: "В начале дня списывает выбранный ресурс за содержание агента.",
    fields: [
      { key: "resource", label: "Ресурс", input: "resource", validator: "resourceRef", defaultResource: "money" },
      { key: "amount", label: "Значение", input: "number", validator: "finiteNumber", default: 0 },
    ],
  },
  {
    type: "movement_cost_percent",
    label: "Мод. перемещения",
    description: "Процентно меняет энергетическую стоимость перемещения. Отрицательное значение удешевляет путь.",
    fields: [{ key: "percent", label: "Процент", input: "number", validator: "finiteNumber", default: 0 }],
  },
  {
    type: "specialization",
    label: "Специализация",
    description: "Даёт преимущество при проверках выбранного типа: ловкости, интеллекта или харизмы.",
    fields: [{ key: "stat", label: "Специализация", input: "stat", validator: "statRef", defaultStat: "agility" }],
  },
  {
    type: "movement_cost_delta",
    label: "Стоимость перемещения",
    description: "Численно меняет энергетическую стоимость каждого шага перемещения.",
    fields: [{ key: "amount", label: "Значение", input: "number", validator: "finiteNumber", default: 0 }],
  },
  {
    type: "path_energy_delta",
    label: "Стоимость конкретного пути",
    description: "Меняет для агента стоимость выбранного пути. Отрицательное значение удешевляет путь.",
    fields: [
      { key: "pathId", label: "Путь", input: "path", validator: "pathRef", defaultPath: "" },
      { key: "amount", label: "Энергия", input: "number", validator: "finiteNumber", default: 0 },
    ],
  },
  {
    type: "grant_status",
    label: "Статус от черты",
    description: "В начале дня накладывает выбранный временный статус, пока черта активна.",
    fields: [
      { key: "statusId", label: "Статус", input: "status", validator: "statusRef", defaultStatus: "" },
      { key: "stacks", label: "Стаки", input: "number", validator: "positiveInteger", default: 1, min: 1 },
    ],
  },
  {
    type: "weekly_inspiration",
    label: "Еженедельное вдохновение",
    description: "В начале каждой недели накладывает на агента два стака статуса «Вдохновение».",
    fields: [],
  },
];

export const TRAIT_EFFECT_REGISTRY = Object.fromEntries(TRAIT_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));

export const TRAIT_EFFECT_TYPES = TRAIT_EFFECT_DEFINITIONS.map((definition) => definition.type);

export const TRAIT_EFFECT_FIELD_KEYS = Object.fromEntries(
  TRAIT_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_EFFECT_KEYS, ...definition.fields.map((field) => field.key)]])
);

function getObjectKeys(value) {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) {
    return value.map((item) => (item && typeof item === "object" ? item.id || item.value : item)).filter(Boolean);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function getFirstAvailableKey(preferredKey, collection, fallbackKey = "") {
  const keys = getObjectKeys(collection);
  if (preferredKey && keys.includes(preferredKey)) return preferredKey;
  if (fallbackKey && keys.includes(fallbackKey)) return fallbackKey;
  return keys[0] || "";
}

export function getTraitEffectDefinition(type) {
  return TRAIT_EFFECT_REGISTRY[type] || null;
}

export function getTraitEffectFieldDefinitions(type) {
  return getTraitEffectDefinition(type)?.fields || [];
}

export function getTraitEffectFieldDefinition(type, fieldKey) {
  return getTraitEffectFieldDefinitions(type).find((field) => field.key === fieldKey) || null;
}

export function getTraitEffectLabel(type) {
  return getTraitEffectDefinition(type)?.label || type;
}

export function getTraitEffectDescription(type) {
  return getTraitEffectDefinition(type)?.description || "Параметризованный эффект черты.";
}

export function getTraitEffectFieldLabel(type, fieldKey) {
  return getTraitEffectFieldDefinition(type, fieldKey)?.label || fieldKey;
}

export function normalizeTraitEffectType(type) {
  return TRAIT_EFFECT_TYPES.includes(type) ? type : TRAIT_EFFECT_TYPES[0];
}

export function findTraitEffectType(type) {
  const normalizedType = String(type || "").trim();
  return TRAIT_EFFECT_TYPES.includes(normalizedType) ? normalizedType : "";
}

export function getDefaultTraitEffectFieldValue(fieldDefinition, context = {}) {
  if (Object.prototype.hasOwnProperty.call(fieldDefinition, "default")) return fieldDefinition.default;
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.agentParameter) {
    return getFirstAvailableKey(fieldDefinition.defaultParameter, TRAIT_AGENT_PARAMETER_OPTIONS, "energy");
  }
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.resource) {
    return getFirstAvailableKey(fieldDefinition.defaultResource, context.resources || context.resourceDefs, "money");
  }
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.stat) {
    return getFirstAvailableKey(fieldDefinition.defaultStat, context.stats || context.statDefs, "agility");
  }
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.status) {
    return getFirstAvailableKey(fieldDefinition.defaultStatus, context.statusEffects, "");
  }
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.path) {
    return getFirstAvailableKey(fieldDefinition.defaultPath, context.paths, "");
  }
  return fieldDefinition.min || 0;
}

export function createDefaultTraitEffect(type = TRAIT_EFFECT_TYPES[0], context = {}) {
  const safeType = normalizeTraitEffectType(type);
  const effect = { type: safeType };
  getTraitEffectFieldDefinitions(safeType).forEach((field) => {
    effect[field.key] = getDefaultTraitEffectFieldValue(field, context);
  });
  return effect;
}

export function normalizeTraitEffectFieldValue(fieldDefinition, value, context = {}) {
  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.stat && value === "mind") {
    return "intelligence";
  }
  if (
    fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.agentParameter ||
    fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.resource ||
    fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.stat ||
    fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.status ||
    fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.path
  ) {
    return String(value || "").trim() || getDefaultTraitEffectFieldValue(fieldDefinition, context);
  }
  const fallback = getDefaultTraitEffectFieldValue(fieldDefinition, context);
  if (fieldDefinition.validator === TRAIT_EFFECT_FIELD_VALIDATORS.positiveInteger) {
    return Math.max(fieldDefinition.min || 1, Math.trunc(Number(value) || fallback));
  }
  return normalizeEffectNumber(value, fallback, { min: fieldDefinition.min });
}

export function normalizeTraitEffect(effect, context = {}) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) return null;
  const type = findTraitEffectType(effect.type);
  if (!type) return null;

  const normalized = { type };
  getTraitEffectFieldDefinitions(type).forEach((field) => {
    normalized[field.key] = normalizeTraitEffectFieldValue(field, effect[field.key], context);
  });
  return normalized;
}

export function normalizeTraitEffectList(effects, context = {}) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => normalizeTraitEffect(effect, context)).filter(Boolean);
}
