import { AGENT_FIELD_KEYS } from "./agent-contract.js";
import { ACTIVITY_FIELD_KEYS, RUNTIME_ACTIVITY_FIELD_KEYS } from "./activity-contract.js";
import { collectActivityEffectListSchemaErrors } from "./activity-effect-registry.js";
import { EVENT_FIELD_KEYS, RUNTIME_EVENT_FIELD_KEYS } from "./event-contract.js";
import { collectEventEffectListSchemaErrors } from "./event-effect-registry.js";
import { FAVOR_FIELD_KEYS } from "./favor-contract.js";
import { STATUS_FIELD_KEYS } from "./status-contract.js";
import { collectStatusEffectListSchemaErrors } from "./status-effect-registry.js";
import { collectTaskEffectListSchemaErrors } from "./task-effect-registry.js";
import { RUNTIME_TASK_FIELD_KEYS, TASK_FIELD_KEYS } from "./task-contract.js";
import { collectTraitEffectSchemaErrors } from "./trait-effect-contract.js";
import { TRAIT_FIELD_KEYS } from "./trait-contract.js";
import { collectUpgradeEffectListSchemaErrors } from "./upgrade-effect-registry.js";
import { RUNTIME_UPGRADE_FIELD_KEYS, UPGRADE_FIELD_KEYS } from "./upgrade-contract.js";
import { LOCATION_FIELD_KEYS, collectLocationMechanicsSchemaErrors, collectLocationVisibilitySchemaErrors } from "./location-contract.js";

const PATH_KEYS = ["id", "a", "b", "type", "name", "energy", "enabled", "toll", "color", "from", "bendEnabled", "bend", "to"];
const ZONE_KEYS = ["id", "name", "code", "color", "center", "labelPosition", "points", "shape"];

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
  if (options.pattern && !options.pattern.test(value)) errors.push(`${context} must match ${options.pattern}`);
}

function collectFiniteNumberErrors(errors, context, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${context} must be a finite number`);
}

function collectOptionalIntegerRangeErrors(errors, context, value, min, max) {
  if (value === undefined) return;
  collectFiniteNumberErrors(errors, context, value);
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  if (Math.trunc(value) !== value) errors.push(`${context} must be an integer`);
  if (value < min || value > max) errors.push(`${context} must be between ${min} and ${max}`);
}

function collectBooleanErrors(errors, context, value) {
  if (typeof value !== "boolean") errors.push(`${context} must be boolean`);
}

function collectOptionalBooleanErrors(errors, context, value) {
  if (value !== undefined) collectBooleanErrors(errors, context, value);
}

function collectStringArrayErrors(errors, context, value) {
  if (!Array.isArray(value)) {
    errors.push(`${context} must be an array`);
    return;
  }
  value.forEach((item, index) => collectStringErrors(errors, `${context}[${index}]`, item));
}

function collectEntityIdErrors(errors, context, value) {
  collectStringErrors(errors, `${context}.id`, value.id);
}

export function collectPointErrors(point, context = "point") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, point)) return errors;
  collectFiniteNumberErrors(errors, `${context}.x`, point.x);
  collectFiniteNumberErrors(errors, `${context}.y`, point.y);
  if (typeof point.x === "number" && Number.isFinite(point.x) && (point.x < 0 || point.x > 100)) {
    errors.push(`${context}.x must be between 0 and 100`);
  }
  if (typeof point.y === "number" && Number.isFinite(point.y) && (point.y < 0 || point.y > 100)) {
    errors.push(`${context}.y must be between 0 and 100`);
  }
  return errors;
}

function collectNullablePointErrors(errors, context, value) {
  if (value === null) return;
  errors.push(...collectPointErrors(value, context));
}

function collectOptionalNullablePointErrors(errors, context, value) {
  if (value === undefined) return;
  collectNullablePointErrors(errors, context, value);
}

export function collectResourceMapErrors(resourceMap, context = "resource map") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, resourceMap)) return errors;
  Object.entries(resourceMap).forEach(([resource, amount]) => {
    collectStringErrors(errors, `${context} resource key`, resource);
    collectFiniteNumberErrors(errors, `${context}.${resource}`, amount);
  });
  return errors;
}

function collectNullableResourceMapErrors(errors, context, value) {
  if (value === null) return;
  errors.push(...collectResourceMapErrors(value, context));
}

function collectOptionalResourceMapErrors(errors, context, value) {
  if (value === undefined) return;
  errors.push(...collectResourceMapErrors(value, context));
}

function collectRuntimeRewardErrors(errors, context, value) {
  if (value === undefined || value === null || typeof value === "function") return;
  errors.push(...collectResourceMapErrors(value, context));
}

function collectSympathyTraitsErrors(errors, context, value) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${context} must be an array`);
    return;
  }
  value.forEach((item, index) => {
    const itemContext = `${context}[${index}]`;
    if (!collectPlainObjectErrors(errors, itemContext, item)) return;
    collectUnexpectedKeyErrors(errors, itemContext, item, ["section", "trait"]);
    collectFiniteNumberErrors(errors, `${itemContext}.section`, item.section);
    collectStringErrors(errors, `${itemContext}.trait`, item.trait);
  });
}

function collectAgentStatusesErrors(errors, context, value) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${context} must be an array`);
    return;
  }
  value.forEach((status, index) => {
    const itemContext = `${context}[${index}]`;
    if (!collectPlainObjectErrors(errors, itemContext, status)) return;
    collectUnexpectedKeyErrors(errors, itemContext, status, ["statusId", "stacks", "remainingDays"]);
    collectStringErrors(errors, `${itemContext}.statusId`, status.statusId);
    ["stacks", "remainingDays"].forEach((field) => {
      collectFiniteNumberErrors(errors, `${itemContext}.${field}`, status[field]);
      if (typeof status[field] === "number" && (!Number.isInteger(status[field]) || status[field] <= 0)) errors.push(`${itemContext}.${field} must be a positive integer`);
    });
  });
}

export function collectAgentSchemaErrors(agent, context = "agent") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, agent)) return errors;
  collectUnexpectedKeyErrors(errors, context, agent, AGENT_FIELD_KEYS);
  collectEntityIdErrors(errors, context, agent);
  collectStringErrors(errors, `${context}.name`, agent.name);
  collectStringErrors(errors, `${context}.role`, agent.role);
  collectStringErrors(errors, `${context}.portrait`, agent.portrait);
  collectStringErrors(errors, `${context}.color`, agent.color);
  collectFiniteNumberErrors(errors, `${context}.maxEnergy`, agent.maxEnergy);
  collectFiniteNumberErrors(errors, `${context}.energy`, agent.energy);
  collectFiniteNumberErrors(errors, `${context}.baseRecovery`, agent.baseRecovery);
  collectOptionalIntegerRangeErrors(errors, `${context}.fatigue`, agent.fatigue, 0, 10);
  collectOptionalBooleanErrors(errors, `${context}.isMainCharacter`, agent.isMainCharacter);
  collectFiniteNumberErrors(errors, `${context}.sympathy`, agent.sympathy);
  collectFiniteNumberErrors(errors, `${context}.overtimeMax`, agent.overtimeMax);
  collectFiniteNumberErrors(errors, `${context}.overtimeLeft`, agent.overtimeLeft);
  collectStringErrors(errors, `${context}.locationId`, agent.locationId);
  collectStringErrors(errors, `${context}.startLocationId`, agent.startLocationId);
  collectStringArrayErrors(errors, `${context}.traits`, agent.traits);
  collectSympathyTraitsErrors(errors, `${context}.sympathyTraits`, agent.sympathyTraits);
  collectAgentStatusesErrors(errors, `${context}.statuses`, agent.statuses);
  return errors;
}

export function collectLocationSchemaErrors(location, context = "location") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, location)) return errors;
  collectUnexpectedKeyErrors(errors, context, location, LOCATION_FIELD_KEYS);
  collectEntityIdErrors(errors, context, location);
  collectStringErrors(errors, `${context}.zoneId`, location.zoneId);
  collectStringErrors(errors, `${context}.name`, location.name);
  collectStringErrors(errors, `${context}.symbol`, location.symbol);
  collectStringErrors(errors, `${context}.accent`, location.accent);
  errors.push(...collectPointErrors(location.position, `${context}.position`));
  collectStringErrors(errors, `${context}.description`, location.description, { allowEmpty: true });
  collectOptionalBooleanErrors(errors, `${context}.dynamic`, location.dynamic);
  errors.push(...collectLocationVisibilitySchemaErrors(location, context));
  errors.push(...collectLocationMechanicsSchemaErrors(location, context));
  return errors;
}

export function collectPathSchemaErrors(pathItem, context = "path", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, pathItem)) return errors;
  const requireSavedFields = options.requireSavedFields ?? true;
  collectUnexpectedKeyErrors(errors, context, pathItem, PATH_KEYS);
  collectEntityIdErrors(errors, context, pathItem);
  collectStringErrors(errors, `${context}.a`, pathItem.a);
  collectStringErrors(errors, `${context}.b`, pathItem.b);
  collectStringErrors(errors, `${context}.type`, pathItem.type);
  collectStringErrors(errors, `${context}.name`, pathItem.name);
  collectFiniteNumberErrors(errors, `${context}.energy`, pathItem.energy);
  collectOptionalBooleanErrors(errors, `${context}.enabled`, pathItem.enabled);
  if (requireSavedFields) {
    errors.push(...collectResourceMapErrors(pathItem.toll, `${context}.toll`));
    collectStringErrors(errors, `${context}.color`, pathItem.color, { allowEmpty: true });
    collectNullablePointErrors(errors, `${context}.from`, pathItem.from);
    collectBooleanErrors(errors, `${context}.bendEnabled`, pathItem.bendEnabled);
    collectNullablePointErrors(errors, `${context}.bend`, pathItem.bend);
    collectNullablePointErrors(errors, `${context}.to`, pathItem.to);
  } else {
    collectOptionalResourceMapErrors(errors, `${context}.toll`, pathItem.toll);
    if (pathItem.color !== undefined) collectStringErrors(errors, `${context}.color`, pathItem.color, { allowEmpty: true });
    collectOptionalNullablePointErrors(errors, `${context}.from`, pathItem.from);
    collectOptionalBooleanErrors(errors, `${context}.bendEnabled`, pathItem.bendEnabled);
    collectOptionalNullablePointErrors(errors, `${context}.bend`, pathItem.bend);
    collectOptionalNullablePointErrors(errors, `${context}.to`, pathItem.to);
  }
  return errors;
}

export function collectTaskSchemaErrors(task, context = "task", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, task)) return errors;
  const requireSavedFields = options.requireSavedFields ?? true;
  collectUnexpectedKeyErrors(errors, context, task, requireSavedFields ? TASK_FIELD_KEYS : RUNTIME_TASK_FIELD_KEYS);
  collectEntityIdErrors(errors, context, task);
  collectStringErrors(errors, `${context}.locationId`, task.locationId);
  collectStringErrors(errors, `${context}.name`, task.name);
  collectStringErrors(errors, `${context}.kind`, task.kind);
  collectFiniteNumberErrors(errors, `${context}.maxPerDay`, task.maxPerDay);
  collectStringErrors(errors, `${context}.description`, task.description, { allowEmpty: true });
  if (requireSavedFields) {
    collectStringErrors(errors, `${context}.stat`, task.stat, { allowEmpty: true });
    collectFiniteNumberErrors(errors, `${context}.difficulty`, task.difficulty);
    if (task.difficultyLevelId !== undefined) collectStringErrors(errors, `${context}.difficultyLevelId`, task.difficultyLevelId, { allowEmpty: true });
    errors.push(...collectResourceMapErrors(task.costResources, `${context}.costResources`));
    errors.push(...collectResourceMapErrors(task.rewards, `${context}.rewards`));
    collectNullableResourceMapErrors(errors, `${context}.success`, task.success);
    collectNullableResourceMapErrors(errors, `${context}.failure`, task.failure);
  } else {
    if (task.kind === "check") {
      collectStringErrors(errors, `${context}.stat`, task.stat, { allowEmpty: true });
      collectFiniteNumberErrors(errors, `${context}.difficulty`, task.difficulty);
      if (task.difficultyLevelId !== undefined) collectStringErrors(errors, `${context}.difficultyLevelId`, task.difficultyLevelId, { allowEmpty: true });
    } else if (task.stat !== undefined) {
      collectStringErrors(errors, `${context}.stat`, task.stat, { allowEmpty: true });
    }
    collectOptionalResourceMapErrors(errors, `${context}.costResources`, task.costResources);
    collectOptionalResourceMapErrors(errors, `${context}.rewards`, task.rewards);
    collectRuntimeRewardErrors(errors, `${context}.success`, task.success);
    collectRuntimeRewardErrors(errors, `${context}.failure`, task.failure);
  }
  errors.push(...collectTaskEffectListSchemaErrors(task.costEffects, `${context}.costEffects`, options));
  errors.push(...collectTaskEffectListSchemaErrors(task.rewardEffects, `${context}.rewardEffects`, options));
  errors.push(...collectTaskEffectListSchemaErrors(task.successEffects, `${context}.successEffects`, options));
  errors.push(...collectTaskEffectListSchemaErrors(task.failureEffects, `${context}.failureEffects`, options));
  return errors;
}

export function collectTraitSchemaErrors(trait, context = "trait", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, trait)) return errors;
  collectUnexpectedKeyErrors(errors, context, trait, TRAIT_FIELD_KEYS);
  collectStringErrors(errors, `${context}.id`, trait.id, { pattern: /^[a-z0-9_-]+$/ });
  collectStringErrors(errors, `${context}.name`, trait.name);
  collectStringErrors(errors, `${context}.description`, trait.description);
  collectStringErrors(errors, `${context}.category`, trait.category);
  collectStringArrayErrors(errors, `${context}.tags`, trait.tags);
  if (!Array.isArray(trait.effects)) {
    errors.push(`${context}.effects must be an array`);
  } else {
    trait.effects.forEach((effect, index) => errors.push(...collectTraitEffectSchemaErrors(effect, `${context}.effects[${index}]`, options)));
  }
  collectOptionalBooleanErrors(errors, `${context}.disabled`, trait.disabled);
  return errors;
}

export function collectUpgradeSchemaErrors(upgrade, context = "upgrade", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, upgrade)) return errors;
  const requireSavedFields = options.requireSavedFields ?? true;
  collectUnexpectedKeyErrors(errors, context, upgrade, requireSavedFields ? UPGRADE_FIELD_KEYS : RUNTIME_UPGRADE_FIELD_KEYS);
  collectEntityIdErrors(errors, context, upgrade);
  collectStringErrors(errors, `${context}.name`, upgrade.name);
  collectStringErrors(errors, `${context}.description`, upgrade.description, { allowEmpty: true });
  errors.push(...collectResourceMapErrors(upgrade.cost, `${context}.cost`));
  errors.push(...collectUpgradeEffectListSchemaErrors(upgrade.buyEffects, `${context}.buyEffects`, options));
  return errors;
}

export function collectEventSchemaErrors(event, context = "event", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, event)) return errors;
  const requireSavedFields = options.requireSavedFields ?? true;
  collectUnexpectedKeyErrors(errors, context, event, requireSavedFields ? EVENT_FIELD_KEYS : RUNTIME_EVENT_FIELD_KEYS);
  collectEntityIdErrors(errors, context, event);
  collectStringErrors(errors, `${context}.name`, event.name);
  collectStringErrors(errors, `${context}.description`, event.description, { allowEmpty: true });
  errors.push(...collectEventEffectListSchemaErrors(event.effects, `${context}.effects`, options));
  return errors;
}

export function collectActivitySchemaErrors(activity, context = "activity", options = {}) {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, activity)) return errors;
  const requireSavedFields = options.requireSavedFields ?? true;
  collectUnexpectedKeyErrors(errors, context, activity, requireSavedFields ? ACTIVITY_FIELD_KEYS : RUNTIME_ACTIVITY_FIELD_KEYS);
  collectEntityIdErrors(errors, context, activity);
  collectStringErrors(errors, `${context}.name`, activity.name);
  collectStringErrors(errors, `${context}.description`, activity.description, { allowEmpty: true });
  collectStringErrors(errors, `${context}.resultDescription`, activity.resultDescription, { allowEmpty: true });
  collectStringErrors(errors, `${context}.kind`, activity.kind);
  if (!["solo", "pair", "group"].includes(activity.kind)) errors.push(`${context}.kind must be solo, pair, or group`);
  errors.push(...collectActivityEffectListSchemaErrors(activity.effects, `${context}.effects`, options));
  return errors;
}

export function collectStatusSchemaErrors(status, context = "status") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, status)) return errors;
  collectUnexpectedKeyErrors(errors, context, status, STATUS_FIELD_KEYS);
  collectEntityIdErrors(errors, context, status);
  collectStringErrors(errors, `${context}.name`, status.name);
  collectStringErrors(errors, `${context}.description`, status.description, { allowEmpty: true });
  ["duration", "maxStacks"].forEach((field) => {
    collectFiniteNumberErrors(errors, `${context}.${field}`, status[field]);
    if (typeof status[field] === "number" && status[field] <= 0) errors.push(`${context}.${field} must be positive`);
  });
  errors.push(...collectStatusEffectListSchemaErrors(status.effects, `${context}.effects`));
  return errors;
}

export function collectFavorSchemaErrors(favor, context = "favor") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, favor)) return errors;
  collectUnexpectedKeyErrors(errors, context, favor, FAVOR_FIELD_KEYS);
  collectStringErrors(errors, `${context}.name`, favor.name);
  errors.push(...collectResourceMapErrors(favor.cost, `${context}.cost`));
  collectFiniteNumberErrors(errors, `${context}.sympathy`, favor.sympathy);
  return errors;
}

export function collectFavorDeckSchemaErrors(favorDeck, context = "favorDeck") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, favorDeck)) return errors;
  Object.entries(favorDeck).forEach(([agentId, favors]) => {
    collectStringErrors(errors, `${context}.${agentId} agent id`, agentId);
    if (!Array.isArray(favors)) {
      errors.push(`${context}.${agentId} must be an array`);
      return;
    }
    favors.forEach((favor, index) => errors.push(...collectFavorSchemaErrors(favor, `${context}.${agentId}[${index}]`)));
  });
  return errors;
}

export function collectZoneSchemaErrors(zone, context = "zone") {
  const errors = [];
  if (!collectPlainObjectErrors(errors, context, zone)) return errors;
  collectUnexpectedKeyErrors(errors, context, zone, ZONE_KEYS);
  collectEntityIdErrors(errors, context, zone);
  collectStringErrors(errors, `${context}.name`, zone.name);
  collectStringErrors(errors, `${context}.code`, zone.code);
  collectStringErrors(errors, `${context}.color`, zone.color);
  errors.push(...collectPointErrors(zone.center, `${context}.center`));
  errors.push(...collectPointErrors(zone.labelPosition, `${context}.labelPosition`));
  collectStringErrors(errors, `${context}.points`, zone.points);
  collectStringErrors(errors, `${context}.shape`, zone.shape);
  return errors;
}
