import { STANDARD_RESOURCE_IDS, STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";
import { collectTaskEffectSchemaErrors, createDefaultTaskEffect, normalizeTaskEffect } from "./task-effect-registry.js";
import { isEffectNumber, normalizeEffectNumber } from "./effect-value.js";

const OUTCOME_OPTIONS = [
  { value: "success", label: "Успех" },
  { value: "failure", label: "Провал" },
];

export const LOCATION_MECHANIC_EFFECT_DEFINITIONS = [
  {
    type: "shop_stock_delta",
    label: "Количество товара",
    description: "Изменяет запас выбранного товара магазина этой локации.",
    fields: [
      { key: "shopId", label: "Магазин", input: "shop", default: "" },
      { key: "offerId", label: "Товар", input: "offer", default: "" },
      { key: "amount", label: "Изменить на", input: "number", default: 1 },
    ],
  },
  {
    type: "shop_offer_lock",
    label: "Доступность товара",
    description: "Блокирует или разблокирует выбранный товар магазина этой локации.",
    fields: [
      { key: "shopId", label: "Магазин", input: "shop", default: "" },
      { key: "offerId", label: "Товар", input: "offer", default: "" },
      { key: "locked", label: "Заблокировать", input: "boolean", default: true },
    ],
  },
  {
    type: "mechanic_value_delta",
    label: "Значение механики",
    description: "Численно изменяет выбранный счётчик или шкалу этой локации.",
    fields: [
      { key: "mechanicId", label: "Механика", input: "mechanic", default: "" },
      { key: "amount", label: "Изменить на", input: "number", default: 1 },
    ],
  },
  {
    type: "task_lock",
    label: "Доступность задачи",
    description: "Блокирует или разблокирует выбранную задачу этой локации.",
    fields: [
      { key: "taskId", label: "Задача", input: "task", default: "" },
      { key: "locked", label: "Заблокировать", input: "boolean", default: true },
    ],
  },
  {
    type: "task_outcome_effect",
    label: "Эффект задачи",
    description: "Добавляет зарегистрированный эффект к успеху или провалу выбранной задачи.",
    fields: [
      { key: "taskId", label: "Задача", input: "task", default: "" },
      { key: "outcome", label: "Результат", input: "select", options: OUTCOME_OPTIONS, default: "success" },
      { key: "effect", label: "Эффект", input: "taskEffect", default: { type: "resource_delta", resource: "money", amount: 1 } },
    ],
  },
  {
    type: "resource_delta",
    label: "Ресурс",
    description: "Численно меняет доступный игровой ресурс.",
    fields: [
      { key: "resource", label: "Ресурс", input: "select", options: STANDARD_RESOURCE_OPTIONS, default: "money" },
      { key: "amount", label: "Изменить на", input: "number", default: 1 },
    ],
  },
];

export const LOCATION_MECHANIC_EFFECT_REGISTRY = Object.fromEntries(LOCATION_MECHANIC_EFFECT_DEFINITIONS.map((definition) => [definition.type, definition]));
export const LOCATION_MECHANIC_EFFECT_TYPES = LOCATION_MECHANIC_EFFECT_DEFINITIONS.map((definition) => definition.type);

export function getLocationMechanicEffectDefinition(type) {
  return LOCATION_MECHANIC_EFFECT_REGISTRY[type] || null;
}

export function normalizeLocationMechanicEffect(effect) {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) return null;
  const definition = getLocationMechanicEffectDefinition(effect.type);
  if (!definition) return null;
  const normalized = { type: definition.type };
  definition.fields.forEach((field) => {
    const legacyKeys = { mechanicId: "mechanic", shopId: "shop", offerId: "offer" };
    const value = effect[field.key] ?? effect[legacyKeys[field.key]];
    if (field.input === "boolean") normalized[field.key] = Boolean(value);
    else if (field.input === "number") normalized[field.key] = normalizeEffectNumber(value, field.default, { min: field.min });
    else if (field.input === "taskEffect") normalized[field.key] = normalizeTaskEffect(value) || createDefaultTaskEffect();
    else if (field.key === "resource") normalized[field.key] = STANDARD_RESOURCE_IDS.includes(value) ? value : field.default;
    else normalized[field.key] = String(value || field.default || "").trim();
  });
  return normalized;
}

export function collectLocationMechanicEffectSchemaErrors(effect, context = "location mechanic effect") {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) return [`${context} must be a plain object`];
  const definition = getLocationMechanicEffectDefinition(effect.type);
  if (!definition) return [`${context}.type must be a known location mechanic effect type`];
  const errors = [];
  const allowed = new Set(["type", ...definition.fields.map((field) => field.key)]);
  Object.keys(effect).forEach((key) => {
    if (!allowed.has(key)) errors.push(`${context} has unexpected key: ${key}`);
  });
  definition.fields.forEach((field) => {
    const value = effect[field.key];
    if (field.input === "number" && !isEffectNumber(value)) errors.push(`${context}.${field.key} must be an integer or range`);
    if (["select", "task", "mechanic", "shop", "offer"].includes(field.input) && (typeof value !== "string" || !value.trim())) {
      errors.push(`${context}.${field.key} must be a non-empty string`);
    }
    if (field.input === "boolean" && typeof value !== "boolean") errors.push(`${context}.${field.key} must be boolean`);
    if (field.input === "taskEffect") errors.push(...collectTaskEffectSchemaErrors(value, `${context}.${field.key}`));
  });
  return errors;
}

export function collectLocationMechanicEffectListSchemaErrors(effects, context = "location mechanic effects") {
  if (!Array.isArray(effects)) return [`${context} must be an array`];
  return effects.flatMap((effect, index) => collectLocationMechanicEffectSchemaErrors(effect, `${context}[${index}]`));
}

export function normalizeLocationMechanicEffectList(effects) {
  return Array.isArray(effects) ? effects.map(normalizeLocationMechanicEffect).filter(Boolean) : [];
}

export function createDefaultLocationMechanicEffect(type = LOCATION_MECHANIC_EFFECT_TYPES[0]) {
  const definition = getLocationMechanicEffectDefinition(type) || LOCATION_MECHANIC_EFFECT_DEFINITIONS[0];
  return normalizeLocationMechanicEffect({ type: definition.type, ...Object.fromEntries(definition.fields.map((field) => [field.key, field.default])) });
}
