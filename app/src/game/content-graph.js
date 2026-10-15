import { TASK_KIND_OPTIONS } from "./task-contract.js";
import { collectActivityEffectListSchemaErrors } from "./activity-effect-registry.js";
import { collectEventEffectListSchemaErrors } from "./event-effect-registry.js";
import { collectTaskEffectListSchemaErrors } from "./task-effect-registry.js";

const DEFAULT_PATH_TYPES = ["bridge", "border", "ferry"];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toIdSet(items) {
  if (items instanceof Set) return items;
  if (Array.isArray(items)) {
    return new Set(items.map((item) => (item && typeof item === "object" ? item.id : item)).filter(Boolean));
  }
  if (items && typeof items === "object") return new Set(Object.keys(items));
  return new Set();
}

function hasResourceMapResources(errors, context, resourceMap, resourceIds) {
  if (!resourceMap || typeof resourceMap !== "object" || Array.isArray(resourceMap)) return;
  Object.keys(resourceMap).forEach((resource) => {
    if (!resourceIds.has(resource)) errors.push(`${context} uses unknown resource: ${resource}`);
  });
}

function collectAgentGraphErrors(errors, agents, locationIds, traitIds, context) {
  agents.forEach((agent) => {
    const agentContext = `${context} agent ${agent.id}`;
    if (!locationIds.has(agent.locationId)) errors.push(`${agentContext} references missing location: ${agent.locationId}`);
    if (!locationIds.has(agent.startLocationId)) errors.push(`${agentContext} references missing startLocationId: ${agent.startLocationId}`);
    toArray(agent.traits).forEach((trait) => {
      if (!traitIds.has(trait)) errors.push(`${agentContext} has unknown trait: ${trait}`);
    });
    toArray(agent.sympathyTraits).forEach((entry) => {
      if (!traitIds.has(entry?.trait)) errors.push(`${agentContext} has unknown sympathy trait: ${entry?.trait}`);
    });
  });
}

function collectPathGraphErrors(errors, paths, zoneIds, resourceIds, pathTypes, context) {
  paths.forEach((pathItem) => {
    const pathContext = `${context} path ${pathItem.id}`;
    if (!zoneIds.has(pathItem.a)) errors.push(`${pathContext} references missing zone a: ${pathItem.a}`);
    if (!zoneIds.has(pathItem.b)) errors.push(`${pathContext} references missing zone b: ${pathItem.b}`);
    if (pathItem.a === pathItem.b) errors.push(`${pathContext} must connect two different zones`);
    if (!pathTypes.has(pathItem.type)) errors.push(`${pathContext} has invalid type: ${pathItem.type}`);
    if (typeof pathItem.energy === "number" && pathItem.energy <= 0) errors.push(`${pathContext} energy must be positive`);
    hasResourceMapResources(errors, `${pathContext} toll`, pathItem.toll, resourceIds);
  });
}

function collectLocationGraphErrors(errors, locations, zoneIds, context) {
  locations.forEach((location) => {
    if (!zoneIds.has(location.zoneId)) errors.push(`${context} location ${location.id} references missing zone: ${location.zoneId}`);
  });
}

function collectTaskGraphErrors(errors, tasks, locationIds, statIds, resourceIds, taskKinds, upgradeIds, statusIds, context) {
  const taskIds = toIdSet(tasks);
  tasks.forEach((task) => {
    const taskContext = `${context} task ${task.id}`;
    if (!locationIds.has(task.locationId)) errors.push(`${taskContext} references missing location: ${task.locationId}`);
    if (!taskKinds.has(task.kind)) errors.push(`${taskContext} has invalid kind: ${task.kind}`);
    if (task.kind === "check" && !statIds.has(task.stat)) errors.push(`${taskContext} has unknown stat: ${task.stat}`);
    if (typeof task.difficulty === "number" && task.difficulty < 0) errors.push(`${taskContext} difficulty must be non-negative`);
    if (typeof task.maxPerDay === "number" && task.maxPerDay <= 0) errors.push(`${taskContext} maxPerDay must be positive`);
    hasResourceMapResources(errors, `${taskContext} costResources`, task.costResources, resourceIds);
    hasResourceMapResources(errors, `${taskContext} rewards`, task.rewards, resourceIds);
    const outcomeResourceIds = new Set([...resourceIds, "fatigue"]);
    hasResourceMapResources(errors, `${taskContext} success`, task.success, outcomeResourceIds);
    hasResourceMapResources(errors, `${taskContext} failure`, task.failure, outcomeResourceIds);
    const effectOptions = { resources: outcomeResourceIds, tasks: taskIds, upgrades: upgradeIds, statusEffects: statusIds };
    errors.push(...collectTaskEffectListSchemaErrors(task.costEffects, `${taskContext} costEffects`, effectOptions));
    errors.push(...collectTaskEffectListSchemaErrors(task.rewardEffects, `${taskContext} rewardEffects`, effectOptions));
    errors.push(...collectTaskEffectListSchemaErrors(task.successEffects, `${taskContext} successEffects`, effectOptions));
    errors.push(...collectTaskEffectListSchemaErrors(task.failureEffects, `${taskContext} failureEffects`, effectOptions));
  });
}

function collectUpgradeGraphErrors(errors, upgrades, resourceIds, context) {
  upgrades.forEach((upgrade) => hasResourceMapResources(errors, `${context} upgrade ${upgrade.id} cost`, upgrade.cost, resourceIds));
}

function collectFavorGraphErrors(errors, favorDeck, agentIds, resourceIds, context) {
  if (!favorDeck || typeof favorDeck !== "object" || Array.isArray(favorDeck)) return;
  Object.entries(favorDeck).forEach(([agentId, favors]) => {
    if (!agentIds.has(agentId)) errors.push(`${context} favor deck references missing agent: ${agentId}`);
    toArray(favors).forEach((favor) => hasResourceMapResources(errors, `${context} favor ${favor?.name || agentId} cost`, favor?.cost, resourceIds));
  });
}

function collectEventGraphErrors(errors, events, resourceIds, statusIds, context) {
  events.forEach((event) => {
    errors.push(...collectEventEffectListSchemaErrors(event.effects, `${context} event ${event.id} effects`, { resources: resourceIds, statusEffects: statusIds }));
  });
}

function collectActivityGraphErrors(errors, activities, resourceIds, statusIds, context) {
  activities.forEach((activity) => {
    const activityContext = `${context} activity ${activity.id}`;
    errors.push(...collectActivityEffectListSchemaErrors(activity.effects, `${activityContext} effects`, { resources: resourceIds, statusEffects: statusIds }));
  });
}

export function collectContentGraphErrors(content, options = {}) {
  const errors = [];
  const context = options.context || "content";
  const agents = toArray(content?.agents);
  const locations = toArray(content?.locations);
  const paths = toArray(content?.paths);
  const tasks = toArray(content?.tasks);
  const zones = toArray(content?.zones);
  const traits = toArray(content?.traits || content?.traitCatalog || options.traits || options.traitCatalog);
  const upgrades = toArray(content?.upgrades || options.upgrades);
  const events = toArray(content?.events || content?.eventDeck || options.events || options.eventDeck);
  const activities = toArray(content?.activities || options.activities);
  const statusEffects = toArray(content?.statusEffects || options.statusEffects);

  const agentIds = toIdSet(agents);
  const locationIds = toIdSet(locations);
  const pathTypes = toIdSet(options.pathTypes || DEFAULT_PATH_TYPES);
  const resourceIds = toIdSet(options.resources || options.resourceDefs || content?.resources || content?.resourceDefs);
  const statIds = toIdSet(options.stats || options.statDefs || content?.stats || content?.statDefs);
  const taskKinds = toIdSet(options.taskKinds || TASK_KIND_OPTIONS);
  const traitIds = toIdSet(traits);
  const upgradeIds = toIdSet(upgrades);
  const zoneIds = toIdSet(zones);
  const statusIds = toIdSet(statusEffects);

  collectPathGraphErrors(errors, paths, zoneIds, resourceIds, pathTypes, context);
  collectLocationGraphErrors(errors, locations, zoneIds, context);
  collectAgentGraphErrors(errors, agents, locationIds, traitIds, context);
  collectTaskGraphErrors(errors, tasks, locationIds, statIds, resourceIds, taskKinds, upgradeIds, statusIds, context);
  collectUpgradeGraphErrors(errors, upgrades, resourceIds, context);
  collectFavorGraphErrors(errors, content?.favorDeck || options.favorDeck, agentIds, resourceIds, context);
  collectEventGraphErrors(errors, events, resourceIds, statusIds, context);
  collectActivityGraphErrors(errors, activities, resourceIds, statusIds, context);

  return errors;
}
