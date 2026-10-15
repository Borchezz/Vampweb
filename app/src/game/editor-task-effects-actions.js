import { editorState, resourceDefs } from "./state.js";
import { locations, statusEffects, tasks, upgrades } from "./data.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import {
  createDefaultTaskEffect,
  getTaskEffectDefinitionsForTarget,
  getTaskEffectFieldDefinition,
  normalizeTaskEffectFieldValue as normalizeTaskEffectRegistryFieldValue,
} from "./task-effect-registry.js";

const OUTCOME_EFFECT_FIELDS = {
  success: "successEffects",
  failure: "failureEffects",
};

function getTaskForEffectAction(taskId) {
  return tasks.find((item) => item.id === taskId);
}

function getEffectFieldForOutcome(outcome) {
  return OUTCOME_EFFECT_FIELDS[outcome] || "";
}

function getTaskEffectContext(outcome, task = null) {
  return {
    resources: resourceDefs,
    resourceDefs,
    tasks,
    upgrades,
    statusEffects,
    target: outcome,
    location: locations.find((location) => location.id === task?.locationId),
  };
}

function createTaskEffect(outcome, type = "", task = null) {
  const definitions = getTaskEffectDefinitionsForTarget(outcome);
  return createDefaultTaskEffect(type || definitions[0]?.type, getTaskEffectContext(outcome, task));
}

function clampTaskStatusStacks(effect) {
  if (effect?.type !== "grant_status") return;
  const maxStacks = statusEffects.find((status) => status.id === effect.statusId)?.maxStacks;
  if (!maxStacks) return;
  effect.stacks = Math.min(maxStacks, Math.max(1, Math.trunc(Number(effect.stacks) || 1)));
}

function finishTaskEffectEdit(task, outcome) {
  editorState.taskId = task.id;
  editorState.locationId = task.locationId;
  editorState.taskLocationId = task.locationId;
  recordEditorChange("task", task.id, getEffectFieldForOutcome(outcome) || "effects");
  saveEditorDraft(true);
  render();
}

export function handleAddTaskEffect(button) {
  const outcome = button.dataset.taskEffectOutcome;
  const field = getEffectFieldForOutcome(outcome);
  const task = getTaskForEffectAction(button.dataset.taskEffectAdd);
  if (!task || !field) return;
  task[field] = Array.isArray(task[field]) ? task[field] : [];
  task[field].push(createTaskEffect(outcome, "", task));
  finishTaskEffectEdit(task, outcome);
}

export function handleRemoveTaskEffect(button) {
  const outcome = button.dataset.taskEffectOutcome;
  const field = getEffectFieldForOutcome(outcome);
  const task = getTaskForEffectAction(button.dataset.taskEffectRemove);
  const index = Number(button.dataset.taskEffectIndex);
  if (!task || !field || !Number.isInteger(index) || !Array.isArray(task[field]) || !task[field][index]) return;
  task[field].splice(index, 1);
  finishTaskEffectEdit(task, outcome);
}

export function handleTaskEffectFieldChange(input) {
  const outcome = input.dataset.taskEffectOutcome;
  const fieldName = getEffectFieldForOutcome(outcome);
  const task = getTaskForEffectAction(input.dataset.taskEffectTask);
  const index = Number(input.dataset.taskEffectIndex);
  const effectField = input.dataset.taskEffectField;
  if (!task || !fieldName || !Number.isInteger(index) || !effectField) return;

  task[fieldName] = Array.isArray(task[fieldName]) ? task[fieldName] : [];
  if (!task[fieldName][index]) task[fieldName][index] = createTaskEffect(outcome, "", task);

  if (effectField === "type") {
    task[fieldName][index] = createTaskEffect(outcome, input.value, task);
    finishTaskEffectEdit(task, outcome);
    return;
  }

  const effect = task[fieldName][index];
  const fieldDefinition = getTaskEffectFieldDefinition(effect.type, effectField);
  if (!fieldDefinition) return;
  const value = input.type === "checkbox" ? input.checked : input.value;
  effect[effectField] = normalizeTaskEffectRegistryFieldValue(fieldDefinition, value, getTaskEffectContext(outcome, task));
  if (effectField === "shopId") {
    const location = locations.find((item) => item.id === task.locationId);
    const shop = location?.mechanics?.find((item) => item.id === effect.shopId);
    effect.offerId = shop?.sellOffers?.[0]?.id || "";
  }
  clampTaskStatusStacks(effect);
  finishTaskEffectEdit(task, outcome);
}
