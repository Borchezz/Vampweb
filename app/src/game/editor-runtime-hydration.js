import { normalizeAgentBlueprint } from "./agent-runtime.js";
import {
  applySavedTaskFields,
  createTaskFromConfig,
  normalizeLoadedPath,
  normalizeLoadedZone,
} from "./content-normalize.js";
import { normalizeEventEntry } from "./event-contract.js";
import { normalizeActivityEntry } from "./activity-contract.js";
import { normalizeStatusEntry } from "./status-contract.js";
import { normalizeTraitCatalog } from "./trait-contract.js";
import { normalizeUpgradeEntry } from "./upgrade-contract.js";
import { deepClone } from "./utils.js";
import { normalizeTaskDifficultyLevels } from "./task-difficulty-settings.js";
import { normalizeLocationEntry } from "./location-contract.js";
import { stabilizeTaskLocationEffectLists } from "./task-effect-registry.js";
import { normalizeBarSettings } from "./bar-settings.js";

export function replaceArray(target, source) {
  target.splice(0, target.length, ...source);
}

function buildTaskPatch(savedTasks, currentTasks, fallbackLocationId, nextLocations = []) {
  const currentTasksById = new Map(currentTasks.map((task) => [task.id, task]));
  const nextTasks = [];
  const savedTaskIds = new Set();

  savedTasks.forEach((savedTask) => {
    if (!savedTask?.id || savedTaskIds.has(savedTask.id)) return;
    savedTaskIds.add(savedTask.id);
    const task = currentTasksById.has(savedTask.id)
      ? deepClone(currentTasksById.get(savedTask.id))
      : createTaskFromConfig(savedTask, { fallbackLocationId });
    const normalizedTask = applySavedTaskFields(task, savedTask);
    nextTasks.push(stabilizeTaskLocationEffectLists(normalizedTask, nextLocations.find((location) => location.id === normalizedTask.locationId)));
  });

  return nextTasks;
}

export function buildEditorRuntimePatch(saved, context = {}) {
  if (!saved) return null;
  const currentTraitCatalog = Array.isArray(context.currentTraitCatalog) ? context.currentTraitCatalog : [];
  const currentTasks = Array.isArray(context.currentTasks) ? context.currentTasks : [];
  const nextTraitCatalog = Array.isArray(saved.traits) ? normalizeTraitCatalog(saved.traits) : currentTraitCatalog;
  const patch = {};

  if (saved.gameSettings && typeof saved.gameSettings === "object" && !Array.isArray(saved.gameSettings)) {
    patch.gameSettings = { ...saved.gameSettings, taskDifficultyLevels: normalizeTaskDifficultyLevels(saved.gameSettings.taskDifficultyLevels) };
  }
  if (saved.initialResources) patch.initialResources = deepClone(saved.initialResources);
  if (saved.barSettings) patch.barSettings = normalizeBarSettings(saved.barSettings);
  if (Array.isArray(saved.traits)) patch.traits = nextTraitCatalog;
  if (Array.isArray(saved.upgrades)) patch.upgrades = saved.upgrades.map((upgrade) => normalizeUpgradeEntry(upgrade));
  if (Array.isArray(saved.events)) patch.events = saved.events.map((event) => normalizeEventEntry(event));
  if (Array.isArray(saved.statusEffects)) patch.statusEffects = saved.statusEffects.map((status) => normalizeStatusEntry(status));
  if (Array.isArray(saved.activities)) patch.activities = saved.activities.map((activity) => normalizeActivityEntry(activity));
  if (Array.isArray(saved.agents) && saved.agents.length) {
    patch.agentBlueprints = saved.agents.map((agent) => normalizeAgentBlueprint(agent, nextTraitCatalog));
  }
  if (Array.isArray(saved.zones) && saved.zones.length) {
    patch.zones = saved.zones.map((zone) => normalizeLoadedZone(zone));
  }

  const savedPaths = Array.isArray(saved.paths) ? saved.paths : saved.connections;
  if (Array.isArray(savedPaths)) {
    patch.paths = savedPaths.map((edge) => normalizeLoadedPath(edge));
  }
  const nextLocations = Array.isArray(saved.locations) && saved.locations.length
    ? saved.locations.map((location) => normalizeLocationEntry(location))
    : (Array.isArray(context.currentLocations) ? context.currentLocations.map(normalizeLocationEntry) : []);
  if (nextLocations.length) patch.locations = nextLocations;
  if (Array.isArray(saved.tasks)) {
    patch.tasks = buildTaskPatch(saved.tasks, currentTasks, context.fallbackLocationId || "", nextLocations);
  }

  return patch;
}

export function applyEditorRuntimePatch(targets, patch) {
  if (!patch) return;
  const { gameSettings, runtime, traitCatalog, upgrades, eventDeck, statusEffects, activities, zones, paths, locations, tasks } = targets;

  if (patch.gameSettings && gameSettings) Object.assign(gameSettings, patch.gameSettings);
  if (patch.initialResources) {
    runtime.initialResources = { ...runtime.initialResources, ...patch.initialResources };
  }
  if (patch.barSettings) runtime.barSettings = { ...runtime.barSettings, ...patch.barSettings };
  if (patch.traits) replaceArray(traitCatalog, patch.traits);
  if (patch.upgrades) replaceArray(upgrades, patch.upgrades);
  if (patch.events) replaceArray(eventDeck, patch.events);
  if (patch.statusEffects) replaceArray(statusEffects, patch.statusEffects);
  if (patch.activities) replaceArray(activities, patch.activities);
  if (patch.agentBlueprints) runtime.agentBlueprints = patch.agentBlueprints;
  if (patch.zones) replaceArray(zones, patch.zones);
  if (patch.paths) replaceArray(paths, patch.paths);
  if (patch.locations) replaceArray(locations, patch.locations);
  if (patch.tasks) replaceArray(tasks, patch.tasks);
}
