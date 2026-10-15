import {
  TRAIT_AGENT_PARAMETER_OPTIONS,
  getTraitEffectDefinition,
  TRAIT_EFFECT_FIELD_KEYS,
  TRAIT_EFFECT_FIELD_VALIDATORS,
} from "./trait-effect-registry.js";
import { isEffectNumber } from "./effect-value.js";

export { TRAIT_EFFECT_FIELD_KEYS, TRAIT_EFFECT_TYPES } from "./trait-effect-registry.js";

function toIdSet(items) {
  if (items instanceof Set) return items;
  if (Array.isArray(items)) {
    return new Set(items.map((item) => (item && typeof item === "object" ? item.id : item)).filter(Boolean));
  }
  if (items && typeof items === "object") return new Set(Object.keys(items));
  return new Set();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectPlainObjectErrors(errors, context, value) {
  if (!isPlainObject(value)) {
    errors.push(`${context} must be a plain object`);
    return false;
  }
  return true;
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

function collectFiniteNumberErrors(errors, context, value) {
  if (!isEffectNumber(value)) errors.push(`${context} must be a finite number or integer range`);
}

function collectPositiveIntegerErrors(errors, context, value) {
  collectFiniteNumberErrors(errors, context, value);
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  if (Math.trunc(value) !== value) errors.push(`${context} must be an integer`);
  if (value <= 0) errors.push(`${context} must be positive`);
}

function collectResourceRefErrors(errors, context, value, resourceIds) {
  collectStringErrors(errors, context, value);
  if (typeof value === "string" && resourceIds.size && !resourceIds.has(value)) {
    errors.push(`${context} uses unknown resource: ${value}`);
  }
}

function collectStatRefErrors(errors, context, value, statIds) {
  collectStringErrors(errors, context, value);
  if (typeof value === "string" && statIds.size && !statIds.has(value)) {
    errors.push(`${context} uses unknown stat: ${value}`);
  }
}

function collectStatusRefErrors(errors, context, value, statusIds) {
  collectStringErrors(errors, context, value);
  if (typeof value === "string" && statusIds.size && !statusIds.has(value)) {
    errors.push(`${context} uses unknown status: ${value}`);
  }
}

function collectPathRefErrors(errors, context, value, pathIds) {
  collectStringErrors(errors, context, value);
  if (typeof value === "string" && pathIds.size && !pathIds.has(value)) {
    errors.push(`${context} uses unknown path: ${value}`);
  }
}

function collectAgentParameterRefErrors(errors, context, value) {
  collectStringErrors(errors, context, value);
  const parameterIds = new Set(TRAIT_AGENT_PARAMETER_OPTIONS.map((option) => option.value));
  if (typeof value === "string" && !parameterIds.has(value)) {
    errors.push(`${context} uses unknown agent parameter: ${value}`);
  }
}

export function collectTraitEffectSchemaErrors(effect, context = "trait effect", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, effect)) return errors;

  collectStringErrors(errors, `${context}.type`, effect.type);
  if (typeof effect.type !== "string") return errors;

  const effectType = effect.type.trim();
  const definition = getTraitEffectDefinition(effectType);
  if (!definition) {
    errors.push(`${context}.type is unknown: ${effect.type}`);
    return errors;
  }

  collectUnexpectedKeyErrors(errors, context, effect, TRAIT_EFFECT_FIELD_KEYS[effectType]);

  const resourceIds = toIdSet(options.resources || options.resourceDefs);
  const statIds = toIdSet(options.stats || options.statDefs);
  const statusIds = toIdSet(options.statusEffects);
  const pathIds = toIdSet(options.paths);

  definition.fields.forEach((field) => {
    const fieldContext = `${context}.${field.key}`;
    const value = effect[field.key];
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.agentParameterRef) collectAgentParameterRefErrors(errors, fieldContext, value);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.finiteNumber) collectFiniteNumberErrors(errors, fieldContext, value);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.positiveInteger) collectPositiveIntegerErrors(errors, fieldContext, value);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.resourceRef) collectResourceRefErrors(errors, fieldContext, value, resourceIds);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.statRef) collectStatRefErrors(errors, fieldContext, value, statIds);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.statusRef) collectStatusRefErrors(errors, fieldContext, value, statusIds);
    if (field.validator === TRAIT_EFFECT_FIELD_VALIDATORS.pathRef) collectPathRefErrors(errors, fieldContext, value, pathIds);
  });

  if (effectType === "grant_status") {
    const status = Array.isArray(options.statusEffects) ? options.statusEffects.find((item) => item.id === effect.statusId) : null;
    if (status && effect.stacks > status.maxStacks) errors.push(`${context}.stacks exceeds status maxStacks: ${status.maxStacks}`);
  }

  return errors;
}

export function isTraitEffectType(effect, type) {
  return effect?.type === type;
}
