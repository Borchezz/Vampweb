import { deepClone } from "./utils.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";
import { STANDARD_RESOURCE_ERROR_MESSAGE, STANDARD_RESOURCE_IDS, STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";

const COMMON_EFFECT_KEYS = ["type"];

export const TASK_AGENT_PARAMETER_OPTIONS = [
  { value: "energy", label: "Энергия" },
  { value: "recovery", label: "Восстановление энергии" },
  { value: "sympathy", label: "Симпатия" },
  { value: "overtime", label: "Энергия переработки" },
  { value: "fatigue", label: "Усталость" },
];

export const TASK_RESOURCE_OPTIONS = STANDARD_RESOURCE_OPTIONS;

const TASK_AGENT_PARAMETER_IDS = new Set(TASK_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
const TASK_RESOURCE_IDS = new Set(STANDARD_RESOURCE_IDS);

export const TASK_EFFECT_FIELDS = {
  agentParameter: "agentParameter",
  boolean: "boolean",
  number: "number",
  resource: "resource",
  resourceMap: "resourceMap",
  rounding: "rounding",
  standardResource: "standardResource",
  task: "task",
  upgrade: "upgrade",
  status: "status",
  statusStacks: "statusStacks",
  locationCounter: "locationCounter",
  locationScale: "locationScale",
  locationShop: "locationShop",
  locationShopOffer: "locationShopOffer",
};

export const TASK_EFFECT_DEFINITIONS = [
  {
    type: "agent_parameter_delta",
    label: "Параметр агента",
    description: "Численно меняет параметр выбранного агента: энергию, восстановление, симпатию, переработку или усталость.",
    targets: ["success", "failure"],
    fields: [
      { key: "parameter", label: "Параметр", input: "agentParameter", defaultParameter: "energy" },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "resource_delta",
    label: "Ресурс",
    description: "Численно меняет деньги, кровь или репутацию. Долг недоступен для этого эффекта.",
    targets: ["cost", "reward", "success", "failure"],
    fields: [
      { key: "resource", label: "Ресурс", input: "standardResource", defaultResource: "money" },
      { key: "amount", label: "Значение", input: "number", default: 0 },
    ],
  },
  {
    type: "grant_upgrade",
    label: "Получить апгрейд",
    description: "Выдаёт конкретный апгрейд или первый доступный, если выбрано any.",
    targets: ["success", "failure"],
    fields: [{ key: "upgradeId", label: "Апгрейд", input: "upgrade", default: "any", allowAny: true }],
  },
  {
    type: "grant_status",
    label: "Получить статус",
    description: "Накладывает на агента выбранный временный статус.",
    targets: ["success", "failure"],
    fields: [
      { key: "statusId", label: "Статус", input: "status", defaultStatus: "" },
      { key: "stacks", label: "Стаки", input: "statusStacks", default: 1, min: 1 },
    ],
  },
  {
    type: "location_counter_increase",
    label: "Счётчик",
    description: "Изменяет значение выбранного счётчика в локации этой задачи.",
    targets: ["success", "failure"],
    fields: [
      { key: "counterId", label: "Счётчик", input: "locationCounter", default: "" },
      { key: "amount", label: "Изменить на", input: "number", default: 1 },
    ],
  },
  {
    type: "location_scale_decrease",
    label: "Шкала",
    description: "Изменяет значение выбранной шкалы в локации этой задачи.",
    targets: ["success", "failure"],
    fields: [
      { key: "scaleId", label: "Шкала", input: "locationScale", default: "" },
      { key: "amount", label: "Изменить на", input: "number", default: -1 },
    ],
  },
  {
    type: "location_shop_stock_increase",
    label: "Добавить товар в магазин",
    description: "Увеличивает запас выбранного товара магазина в локации этой задачи.",
    targets: ["success", "failure"],
    fields: [
      { key: "shopId", label: "Магазин", input: "locationShop", default: "" },
      { key: "offerId", label: "Товар", input: "locationShopOffer", default: "" },
      { key: "amount", label: "Добавить единиц", input: "number", default: 1, min: 1 },
    ],
  },
  {
    type: "location_shop_offer_lock",
    label: "Блок товара",
    description: "Блокирует или разблокирует выбранный товар магазина в локации этой задачи.",
    targets: ["success", "failure"],
    fields: [
      { key: "shopId", label: "Магазин", input: "locationShop", default: "" },
      { key: "offerId", label: "Товар", input: "locationShopOffer", default: "" },
      { key: "locked", label: "Заблокировать", input: "boolean", default: true },
    ],
  },
];

export const TASK_EFFECT_REGISTRY = Object.fromEntries(TASK_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const TASK_EFFECT_TYPES = TASK_EFFECT_DEFINITIONS.map((definition) => definition.type);
export const TASK_EFFECT_FIELD_KEYS = Object.fromEntries(
  TASK_EFFECT_DEFINITIONS.map((definition) => [definition.type, [...COMMON_EFFECT_KEYS, ...definition.fields.map((field) => field.key)]])
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

function normalizeFiniteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function getTaskEffectDefinition(type) {
  return TASK_EFFECT_REGISTRY[type] || null;
}

export function getTaskEffectDefinitionsForTarget(target) {
  return TASK_EFFECT_DEFINITIONS.filter((definition) => !target || definition.targets?.includes(target));
}

export function getTaskEffectFieldDefinitions(type) {
  return getTaskEffectDefinition(type)?.fields || [];
}

export function getTaskEffectFieldDefinition(type, fieldKey) {
  return getTaskEffectFieldDefinitions(type).find((field) => field.key === fieldKey) || null;
}

export function getTaskEffectLabel(type) {
  return getTaskEffectDefinition(type)?.label || type;
}

export function getTaskEffectDescription(type) {
  return getTaskEffectDefinition(type)?.description || "Параметризованный эффект задачи.";
}

export function getTaskEffectFieldLabel(type, fieldKey) {
  return getTaskEffectFieldDefinition(type, fieldKey)?.label || fieldKey;
}

export function findTaskEffectType(type) {
  const normalizedType = String(type || "").trim();
  return TASK_EFFECT_TYPES.includes(normalizedType) ? normalizedType : "";
}

export function getDefaultTaskEffectFieldValue(fieldDefinition, context = {}) {
  if (Object.prototype.hasOwnProperty.call(fieldDefinition, "default")) return fieldDefinition.default;
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.resource) {
    return getFirstAvailableKey(fieldDefinition.defaultResource, context.resources || context.resourceDefs, "money");
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.standardResource) {
    return getFirstAvailableKey(fieldDefinition.defaultResource, TASK_RESOURCE_OPTIONS, "money");
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.agentParameter) {
    return getFirstAvailableKey(fieldDefinition.defaultParameter, TASK_AGENT_PARAMETER_OPTIONS, "energy");
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.task) {
    return getFirstAvailableKey(fieldDefinition.defaultTask, context.tasks, "");
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.upgrade) {
    return getFirstAvailableKey(fieldDefinition.defaultUpgrade, context.upgrades, "");
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.status) {
    return getFirstAvailableKey(fieldDefinition.defaultStatus, context.statusEffects, "");
  }
  return fieldDefinition.min || 0;
}

export function normalizeTaskEffectFieldValue(fieldDefinition, value, context = {}) {
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.resource) {
    return String(value || "").trim() || getDefaultTaskEffectFieldValue(fieldDefinition, context);
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.standardResource) {
    const resource = String(value || "").trim();
    return TASK_RESOURCE_IDS.has(resource) ? resource : getDefaultTaskEffectFieldValue(fieldDefinition, context);
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.agentParameter) {
    const parameter = String(value || "").trim();
    return TASK_AGENT_PARAMETER_IDS.has(parameter) ? parameter : getDefaultTaskEffectFieldValue(fieldDefinition, context);
  }
  if ([TASK_EFFECT_FIELDS.locationCounter, TASK_EFFECT_FIELDS.locationScale, TASK_EFFECT_FIELDS.locationShop, TASK_EFFECT_FIELDS.locationShopOffer].includes(fieldDefinition.input)) {
    return String(value || getDefaultTaskEffectFieldValue(fieldDefinition, context));
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.task || fieldDefinition.input === TASK_EFFECT_FIELDS.upgrade || fieldDefinition.input === TASK_EFFECT_FIELDS.status) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue && fieldDefinition.allowAny) return "any";
    return normalizedValue;
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.boolean) {
    return Boolean(value);
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.statusStacks) {
    return Math.max(1, Math.trunc(normalizeFiniteNumber(value, 1)));
  }
  if (fieldDefinition.input === TASK_EFFECT_FIELDS.rounding) {
    return ["ceil", "floor", "round"].includes(value) ? value : getDefaultTaskEffectFieldValue(fieldDefinition, context);
  }
  const fallback = getDefaultTaskEffectFieldValue(fieldDefinition, context);
  return normalizeEffectNumber(value, fallback, { min: fieldDefinition.min });
}

export function normalizeTaskEffect(effect, context = {}) {
  if (!isPlainObject(effect)) return null;
  const type = findTaskEffectType(effect.type);
  if (!type) return null;

  const normalized = { type };
  const legacyFields = { counterId: "counter", scaleId: "scale" };
  getTaskEffectFieldDefinitions(type).forEach((field) => {
    let value = effect[field.key] ?? effect[legacyFields[field.key]];
    if (field.key === "shopId" && value === undefined && effect.offer) value = String(effect.offer).split(":")[0];
    if (field.key === "offerId" && value === undefined && effect.offer) value = String(effect.offer).split(":")[1];
    normalized[field.key] = normalizeTaskEffectFieldValue(field, value, context);
  });
  return normalized;
}

export function createDefaultTaskEffect(type = TASK_EFFECT_TYPES[0], context = {}) {
  const safeType = findTaskEffectType(type) || getTaskEffectDefinitionsForTarget(context.target)[0]?.type || TASK_EFFECT_TYPES[0];
  const effect = { type: safeType };
  getTaskEffectFieldDefinitions(safeType).forEach((field) => {
    effect[field.key] = normalizeTaskEffectFieldValue(field, getDefaultTaskEffectFieldValue(field, context), context);
  });
  const location = context.location;
  if (location) {
    const counter = location.mechanics?.find((mechanic) => mechanic.type === "counter");
    const scale = location.mechanics?.find((mechanic) => mechanic.type === "scale");
    const shop = location.mechanics?.find((mechanic) => mechanic.type === "shop");
    if (Object.hasOwn(effect, "counterId") && !effect.counterId) effect.counterId = counter?.id || "";
    if (Object.hasOwn(effect, "scaleId") && !effect.scaleId) effect.scaleId = scale?.id || "";
    if (Object.hasOwn(effect, "shopId") && !effect.shopId) effect.shopId = shop?.id || "";
    if (Object.hasOwn(effect, "offerId") && !effect.offerId) effect.offerId = shop?.sellOffers?.[0]?.id || "";
  }
  return effect;
}

export function normalizeTaskEffectList(effects, context = {}) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => normalizeTaskEffect(effect, context)).filter(Boolean);
}

function hasKnownRef(collection, value) {
  if (!value) return true;
  const keys = getObjectKeys(collection);
  return !keys.length || keys.includes(value);
}

export function collectTaskEffectSchemaErrors(effect, context = "task effect", options = {}) {
  const errors = [];
  if (!isPlainObject(effect)) return [`${context} must be a plain object`];

  const type = findTaskEffectType(effect.type);
  if (!type) return [`${context}.type must be a known task effect type`];

  const allowedKeys = new Set(TASK_EFFECT_FIELD_KEYS[type]);
  Object.keys(effect).forEach((key) => {
    if (!allowedKeys.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });

  getTaskEffectFieldDefinitions(type).forEach((field) => {
    const value = effect[field.key];
    if (field.input === TASK_EFFECT_FIELDS.resource) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a resource id`);
      if (value && !hasKnownRef(options.resources || options.resourceDefs, value)) errors.push(`${context}.${field.key} references unknown resource: ${value}`);
    } else if (field.input === TASK_EFFECT_FIELDS.standardResource) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a resource id`);
      if (value && !TASK_RESOURCE_IDS.has(value)) errors.push(`${context}.${field.key} ${STANDARD_RESOURCE_ERROR_MESSAGE}`);
    } else if (field.input === TASK_EFFECT_FIELDS.agentParameter) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be an agent parameter`);
      if (value && !TASK_AGENT_PARAMETER_IDS.has(value)) errors.push(`${context}.${field.key} must be energy, recovery, sympathy, overtime, or fatigue`);
    } else if (field.input === TASK_EFFECT_FIELDS.status) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a status id`);
      if (value && !hasKnownRef(options.statusEffects, value)) errors.push(`${context}.${field.key} references unknown status: ${value}`);
    } else if (field.input === TASK_EFFECT_FIELDS.statusStacks) {
      if (!Number.isInteger(value) || value < 1) errors.push(`${context}.${field.key} must be a positive integer`);
      const status = Array.isArray(options.statusEffects) ? options.statusEffects.find((item) => item.id === effect.statusId) : null;
      if (status && value > status.maxStacks) errors.push(`${context}.${field.key} exceeds status maxStacks: ${status.maxStacks}`);
    } else if (field.input === TASK_EFFECT_FIELDS.task) {
      if (value && !hasKnownRef(options.tasks, value)) errors.push(`${context}.${field.key} references unknown task: ${value}`);
    } else if (field.input === TASK_EFFECT_FIELDS.upgrade) {
      if (field.allowAny && value === "any") return;
      if (value && !hasKnownRef(options.upgrades, value)) errors.push(`${context}.${field.key} references unknown upgrade: ${value}`);
    } else if (field.input === TASK_EFFECT_FIELDS.boolean) {
      if (typeof value !== "boolean") errors.push(`${context}.${field.key} must be boolean`);
    } else if ([TASK_EFFECT_FIELDS.locationCounter, TASK_EFFECT_FIELDS.locationScale, TASK_EFFECT_FIELDS.locationShop, TASK_EFFECT_FIELDS.locationShopOffer].includes(field.input)) {
      if (typeof value !== "string" || !value.trim()) errors.push(`${context}.${field.key} must be a location mechanic reference`);
    } else if (field.input === TASK_EFFECT_FIELDS.rounding) {
      if (!["ceil", "floor", "round"].includes(value)) errors.push(`${context}.${field.key} must be ceil, floor, or round`);
    } else if (!isEffectNumber(value)) {
      errors.push(`${context}.${field.key} must be an integer or range`);
    }
  });

  return errors;
}

export function collectTaskEffectListSchemaErrors(effects, context = "task effects", options = {}) {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectTaskEffectSchemaErrors(effect, `${context}[${index}]`, options));
}

export function cloneTaskEffectList(effects, context = {}) {
  return normalizeTaskEffectList(Array.isArray(effects) ? deepClone(effects) : [], context);
}

export function stabilizeTaskEffectLocationReferences(effect, location) {
  const normalized = normalizeTaskEffect(effect);
  if (!normalized || !location) return normalized;
  const mechanics = Array.isArray(location.mechanics) ? location.mechanics : [];
  const resolveMechanic = (reference, type) => {
    const byId = mechanics.find((mechanic) => mechanic.id === String(reference));
    if (byId?.type === type) return byId;
    const byIndex = Number.isInteger(Number(reference)) ? mechanics[Number(reference)] : null;
    return byIndex?.type === type ? byIndex : null;
  };
  if (Object.hasOwn(normalized, "counterId")) normalized.counterId = resolveMechanic(normalized.counterId, "counter")?.id || normalized.counterId;
  if (Object.hasOwn(normalized, "scaleId")) normalized.scaleId = resolveMechanic(normalized.scaleId, "scale")?.id || normalized.scaleId;
  if (Object.hasOwn(normalized, "shopId")) {
    const shops = mechanics.filter((mechanic) => mechanic.type === "shop");
    const shop = shops.find((mechanic) => mechanic.id === String(normalized.shopId)) || shops[Number(normalized.shopId)];
    normalized.shopId = shop?.id || normalized.shopId;
    const offer = shop?.sellOffers?.find((item) => item.id === String(normalized.offerId)) || shop?.sellOffers?.[Number(normalized.offerId)];
    normalized.offerId = offer?.id || normalized.offerId;
  }
  return normalized;
}

export function stabilizeTaskLocationEffectLists(task, location) {
  const next = deepClone(task);
  ["successEffects", "failureEffects"].forEach((field) => {
    next[field] = (Array.isArray(next[field]) ? next[field] : []).map((effect) => stabilizeTaskEffectLocationReferences(effect, location)).filter(Boolean);
  });
  return next;
}
