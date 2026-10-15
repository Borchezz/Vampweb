import { editorState, gameSettings, resourceDefs, runtime, state, statDefs } from "./state.js";
import { activities, eventDeck, locations, paths, statusEffects, tasks, traitCatalog, upgrades, zones } from "./data.js";
import { getEntityCreateDraft, openEntityCreateForm, resetEntityCreateDraft } from "./editor-entity-crud.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { clampZoneLabelPosition, formatZonePoints, getPathBend, getPathEndpoints, isPathBendEnabled, parseZonePointsForEditor, resetPathBend, resetPathEndpoints, setPathBend, snapPathEndpoint } from "./map-utils.js";
import { render } from "./render-core.js";
import { renderEditor } from "./editor-render.js";
import { showToast } from "./actions.js";
import { deepClone } from "./utils.js";
import { getNextSympathyTraitSection, getSympathyTraitEntries, normalizeSympathyTraitEntry } from "./agent-traits.js";
import { normalizeAgentFatigue } from "./agent-parameters.js";
import { addTraitRef, getDefaultSympathyTraitRef, isTraitRefSelected, normalizeTraitEntry, removeTraitRef } from "./trait-catalog.js";
import { createPathToll, getCreateTrimFields, getEditorFieldMetadata, getPathTollAmount, getPathTollResource, getPathTypeLabel, getRequiredCreateFields } from "./editor-entity-metadata.js";
import { normalizeUpgradeEntry } from "./upgrade-contract.js";
import { normalizeEventEntry } from "./event-contract.js";
import { normalizeActivityEntry } from "./activity-contract.js";
import { normalizeStatusEntry } from "./status-contract.js";
import { setPathEnabled } from "./path-runtime.js";
import { getTaskDifficultyOptions } from "./task-difficulty-settings.js";

export function parseCsv(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseJsonObject(value, fallback = {}) {
  const text = String(value).trim();
  if (!text) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON в поле некорректен.");
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  throw new Error('JSON должен быть объектом, например {"money": 1}.');
}

export function parseJsonArray(value, fallback = []) {
  const text = String(value).trim();
  if (!text) return fallback;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON в поле некорректен.");
  }
  if (Array.isArray(parsed)) return parsed;
  throw new Error('JSON должен быть массивом, например [{"type":"note"}].');
}

function getEntityMetadataContext(overrides = {}) {
  return {
    locations,
    zones,
    statDefs,
    resourceDefs,
    initialResources: runtime.initialResources,
    taskDifficultyLevels: gameSettings.taskDifficultyLevels,
    agents: runtime.agentBlueprints,
    ...overrides,
  };
}

function uniqueFields(fields) {
  return Array.from(new Set(fields.filter(Boolean)));
}

function normalizeMetadataValue(input, fieldMetadata) {
  const parseAs = fieldMetadata?.parseAs || "";
  const control = fieldMetadata?.control || "";
  if (control === "checkbox" || input.type === "checkbox") return input.checked;
  if (parseAs === "fatigue") return normalizeAgentFatigue(input.value);
  if (parseAs === "integer") return Math.trunc(Number(input.value)) || 0;
  if (parseAs === "number" || control === "number") return Number(input.value) || 0;
  if (parseAs === "csv" || control === "csvTextarea") return parseCsv(input.value);
  if (parseAs === "jsonArray" || control === "jsonArray") return parseJsonArray(input.value, fieldMetadata.fallback || []);
  if (parseAs === "jsonObject" || control === "jsonObject" || control === "nullableJsonObject") {
    return parseJsonObject(input.value, fieldMetadata.fallback || {});
  }
  return input.value;
}

export function setNestedValue(target, field, value) {
  const parts = field.split(".");
  let cursor = target;
  while (parts.length > 1) {
    const part = parts.shift();
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[0]] = value;
}

export function normalizeEditorValue(input) {
  const scope = input.dataset.editScope;
  const field = input.dataset.editField;
  if (scope === "zone" && field === "points") return parseZonePointsForEditor(input.value);

  const fieldMetadata = getEditorFieldMetadata(scope, field, getEntityMetadataContext());
  if (fieldMetadata) return normalizeMetadataValue(input, fieldMetadata);

  if (input.type === "checkbox") return input.checked;
  if (scope === "resource" || field.endsWith(".x") || field.endsWith(".y")) return Number(input.value) || 0;
  if (field === "sympathy") return Math.trunc(Number(input.value)) || 0;
  if (field === "fatigue") return normalizeAgentFatigue(input.value);
  if (
    [
      "maxEnergy",
      "energy",
      "baseRecovery",
      "overtimeMax",
      "difficulty",
      "maxPerDay",
    ].includes(field)
  ) {
    return Number(input.value) || 0;
  }
  if (field === "traits") return parseCsv(input.value);
  if (scope === "trait" && field === "tags") return parseCsv(input.value);
  if (scope === "trait" && field === "effects") return parseJsonArray(input.value, []);
  if (["costEffects", "rewardEffects", "successEffects", "failureEffects"].includes(field)) {
    return parseJsonArray(input.value, []);
  }
  if (field === "success" || field === "failure") {
    if (!String(input.value).trim()) {
      const label = field === "success" ? "успеха" : "провала";
      throw new Error(`Пустое поле ${label} не сохраняется; используйте {} для пустого эффекта.`);
    }
    return parseJsonObject(input.value, {});
  }
  if (["toll", "costResources", "rewards"].includes(field)) {
    return parseJsonObject(input.value, {});
  }
  return input.value;
}

export function syncAgentToState(agentId, field, value) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) return;
  setNestedValue(agent, field, deepClone(value));
  if (field === "maxEnergy") agent.energy = Math.min(agent.energy, agent.maxEnergy);
  if (field === "overtimeMax") agent.overtimeLeft = Math.min(agent.overtimeLeft, agent.overtimeMax);
}

export function createTaskId(locationId) {
  let index = tasks.filter((task) => task.locationId === locationId).length + 1;
  let id = `${locationId}-task-${index}`;
  while (tasks.some((task) => task.id === id)) {
    index += 1;
    id = `${locationId}-task-${index}`;
  }
  return id;
}

export function createDefaultTask(locationId) {
  return {
    id: createTaskId(locationId),
    locationId,
    name: "Новая задача",
    kind: "check",
    stat: "none",
    difficulty: 0,
    difficultyLevelId: getTaskDifficultyOptions(gameSettings.taskDifficultyLevels).selectedId,
    maxPerDay: 1,
    description: "",
    costResources: {},
    rewards: {},
    success: {},
    failure: {},
    costEffects: [],
    rewardEffects: [],
    successEffects: [],
    failureEffects: [],
  };
}

function trimDraftFields(draft, fields) {
  fields.forEach((field) => {
    draft[field] = String(draft[field] ?? "").trim();
  });
}

function validateRequiredFields(draft, fields, label) {
  const missing = fields.filter((field) => !String(draft[field] ?? "").trim());
  if (!missing.length) return true;
  showToast(`${label}: заполните обязательные поля. Проверьте форму и попробуйте сохранить снова.`);
  return false;
}

function validateEntityId(id, items, label) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    showToast(`${label}: ID может содержать только латиницу, цифры, _ и -. Проверьте форму и попробуйте сохранить снова.`);
    return false;
  }
  if (items.some((item) => item.id === id)) {
    showToast(`${label}: ID уже используется. Проверьте форму и попробуйте сохранить снова.`);
    return false;
  }
  return true;
}

function trimCreateDraftFields(scope, draft, context = {}, extraFields = []) {
  trimDraftFields(draft, uniqueFields([...getCreateTrimFields(scope, getEntityMetadataContext(context)), ...extraFields]));
}

function validateCreateRequiredFields(scope, draft, label, context = {}, extraFields = []) {
  return validateRequiredFields(draft, uniqueFields([...getRequiredCreateFields(scope, getEntityMetadataContext(context)), ...extraFields]), label);
}

function getCreateContext(element) {
  return {
    locationId: element.dataset.editorCreateContext || element.closest("[data-editor-create-context]")?.dataset.editorCreateContext || "",
  };
}

function getZoneDraftShape() {
  const index = zones.length;
  const x = 18 + (index * 9) % 58;
  const y = 18 + (index * 7) % 58;
  return {
    center: { x, y },
    points: `${x - 5},${y - 4} ${x + 5},${y - 4} ${x + 6},${y + 4} ${x - 4},${y + 5}`,
  };
}

function getNextColor(index) {
  const colors = ["#dfb257", "#48b6a7", "#6d9fce", "#8a73db", "#78b66c", "#d9485f"];
  return colors[index % colors.length];
}

function selectFirstTaskForLocation(locationId) {
  editorState.taskId = tasks.find((task) => task.locationId === locationId)?.id || "";
}

function setEditorEntityView(scope, view) {
  if (Object.prototype.hasOwnProperty.call(editorState.entityViews, scope)) {
    editorState.entityViews[scope] = view;
  }
}

function createAgent(draft) {
  trimDraftFields(draft, ["id", "name", "role", "locationId"]);
  if (!validateRequiredFields(draft, ["id", "name", "role", "locationId"], "Новый агент")) return;
  if (!validateEntityId(draft.id, runtime.agentBlueprints, "Новый агент")) return;
  const location = locations.find((item) => item.id === draft.locationId);
  if (!location) {
    showToast("Новый агент: выберите существующую стартовую локацию. Проверьте форму и попробуйте сохранить снова.");
    return;
  }

  const agent = {
    id: draft.id,
    name: draft.name,
    role: draft.role,
    portrait: draft.name.slice(0, 2).toUpperCase(),
    color: getNextColor(runtime.agentBlueprints.length),
    maxEnergy: 24,
    energy: 16,
    baseRecovery: 8,
    fatigue: 0,
    isMainCharacter: false,
    sympathy: 0,
    overtimeMax: 6,
    overtimeLeft: 6,
    locationId: location.id,
    startLocationId: location.id,
    traits: [],
    sympathyTraits: [],
    statuses: [],
  };
  runtime.agentBlueprints.push(agent);
  state.agents.push(deepClone(agent));
  editorState.agentId = agent.id;
  setEditorEntityView("agents", "edit");
  state.selectedAgentId = agent.id;
  recordEditorChange("agent", agent.id, "create");
  resetEntityCreateDraft("agent");
  saveEditorDraft(true);
  render();
}

function createTrait(draft) {
  trimDraftFields(draft, ["id", "name"]);
  if (!validateRequiredFields(draft, ["id", "name"], "Новая черта")) return;
  if (!validateEntityId(draft.id, traitCatalog, "Новая черта")) return;
  const trait = normalizeTraitEntry({
    id: draft.id,
    name: draft.name,
    description: "",
    effects: [],
  });
  traitCatalog.push(trait);
  editorState.tab = "traits";
  editorState.traitId = trait.id;
  setEditorEntityView("traits", "edit");
  recordEditorChange("trait", trait.id, "create");
  resetEntityCreateDraft("trait");
  saveEditorDraft(true);
  render();
}

function createUpgrade(draft) {
  trimCreateDraftFields("upgrade", draft);
  if (!validateCreateRequiredFields("upgrade", draft, "Новый апгрейд")) return;
  if (!validateEntityId(draft.id, upgrades, "Новый апгрейд")) return;
  const upgrade = normalizeUpgradeEntry({
    id: draft.id,
    name: draft.name,
    cost: {},
    description: "",
    buyEffects: [],
  });
  upgrades.push(upgrade);
  editorState.tab = "upgrades";
  editorState.upgradeId = upgrade.id;
  setEditorEntityView("upgrades", "edit");
  recordEditorChange("upgrade", upgrade.id, "create");
  resetEntityCreateDraft("upgrade");
  saveEditorDraft(true);
  render();
}

function createEvent(draft) {
  trimCreateDraftFields("event", draft);
  if (!validateCreateRequiredFields("event", draft, "Новое событие")) return;
  if (!validateEntityId(draft.id, eventDeck, "Новое событие")) return;
  const event = normalizeEventEntry({
    id: draft.id,
    name: draft.name,
    description: "",
    effects: [],
  });
  eventDeck.push(event);
  editorState.tab = "events";
  editorState.eventId = event.id;
  setEditorEntityView("events", "edit");
  recordEditorChange("event", event.id, "create");
  resetEntityCreateDraft("event");
  saveEditorDraft(true);
  render();
}

function createActivity(draft) {
  trimCreateDraftFields("activity", draft);
  if (!validateCreateRequiredFields("activity", draft, "Новая активность")) return;
  if (!validateEntityId(draft.id, activities, "Новая активность")) return;
  const activity = normalizeActivityEntry({
    id: draft.id,
    name: draft.name,
    kind: draft.kind,
    description: "",
    resultDescription: "",
    effects: [],
  });
  activities.push(activity);
  editorState.tab = "activities";
  editorState.activityId = activity.id;
  setEditorEntityView("activities", "edit");
  recordEditorChange("activity", activity.id, "create");
  resetEntityCreateDraft("activity");
  saveEditorDraft(true);
  render();
}

function createStatus(draft) {
  trimCreateDraftFields("status", draft);
  if (!validateCreateRequiredFields("status", draft, "Новый статусный эффект")) return;
  if (!validateEntityId(draft.id, statusEffects, "Новый статусный эффект")) return;
  const status = normalizeStatusEntry({ id: draft.id, name: draft.name, description: "", duration: 1, maxStacks: 1, effects: [] });
  statusEffects.push(status);
  editorState.tab = "statuses";
  editorState.statusId = status.id;
  setEditorEntityView("statuses", "edit");
  recordEditorChange("status", status.id, "create");
  resetEntityCreateDraft("status");
  saveEditorDraft(true);
  render();
}

function createZone(draft) {
  trimDraftFields(draft, ["id", "name", "code"]);
  if (!validateRequiredFields(draft, ["id", "name", "code"], "Новая зона")) return;
  if (!validateEntityId(draft.id, zones, "Новая зона")) return;
  const shape = getZoneDraftShape();
  const zone = {
    id: draft.id,
    name: draft.name,
    code: draft.code,
    color: getNextColor(zones.length),
    center: shape.center,
    labelPosition: { ...shape.center },
    points: shape.points,
    shape: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
  };
  zones.push(zone);
  editorState.tab = "zones";
  editorState.zoneId = zone.id;
  setEditorEntityView("zones", "edit");
  runtime.pathEndpointEditMode = false;
  recordEditorChange("zone", zone.id, "create");
  resetEntityCreateDraft("zone");
  saveEditorDraft(true);
  render();
}

function createPath(draft) {
  trimCreateDraftFields("path", draft);
  if (!validateCreateRequiredFields("path", draft, "Новый путь")) return;
  if (draft.a === draft.b) {
    showToast("Новый путь: выберите две разные зоны. Проверьте форму и попробуйте сохранить снова.");
    return;
  }
  const zoneA = zones.find((zone) => zone.id === draft.a);
  const zoneB = zones.find((zone) => zone.id === draft.b);
  if (!zoneA || !zoneB) {
    showToast("Новый путь: выберите существующие зоны. Проверьте форму и попробуйте сохранить снова.");
    return;
  }
  const id = `${zoneA.id}-${zoneB.id}-${draft.type}`;
  if (!validateEntityId(id, paths, "Новый путь")) return;
  const path = {
    id,
    name: `${getPathTypeLabel(draft.type)} ${zoneA.name}-${zoneB.name}`,
    type: draft.type,
    a: draft.a,
    b: draft.b,
    energy: 2,
    enabled: true,
    toll: {},
    color: "",
    from: null,
    bendEnabled: false,
    bend: null,
    to: null,
  };
  paths.push(path);
  editorState.tab = "paths";
  editorState.pathId = path.id;
  setEditorEntityView("paths", "edit");
  recordEditorChange("path", path.id, "create");
  resetEntityCreateDraft("path");
  saveEditorDraft(true);
  render();
}

function createLocation(draft) {
  trimDraftFields(draft, ["id", "name", "symbol", "zoneId"]);
  if (!validateRequiredFields(draft, ["id", "name", "symbol", "zoneId"], "Новая локация")) return;
  if (!validateEntityId(draft.id, locations, "Новая локация")) return;
  const zone = zones.find((item) => item.id === draft.zoneId);
  if (!zone) {
    showToast("Новая локация: выберите существующую зону. Проверьте форму и попробуйте сохранить снова.");
    return;
  }
  const location = {
    id: draft.id,
    zoneId: zone.id,
    name: draft.name,
    symbol: draft.symbol,
    accent: zone.color,
    position: { ...(zone.center || { x: 50, y: 50 }) },
    description: "",
    visibilityConditions: [],
  };
  locations.push(location);
  editorState.tab = "locations";
  editorState.locationId = location.id;
  editorState.taskLocationId = location.id;
  editorState.taskId = "";
  setEditorEntityView("locations", "location");
  state.selectedLocationId = location.id;
  recordEditorChange("location", location.id, "create");
  resetEntityCreateDraft("location");
  saveEditorDraft(true);
  render();
}

function createTask(draft, context) {
  draft.locationId = context.locationId || draft.locationId;
  trimDraftFields(draft, ["id", "name", "kind", "locationId"]);
  if (!validateRequiredFields(draft, ["id", "name", "kind", "locationId"], "Новая задача")) return;
  if (!validateEntityId(draft.id, tasks, "Новая задача")) return;
  const location = locations.find((item) => item.id === draft.locationId);
  if (!location) {
    showToast("Новая задача: выберите существующую локацию. Проверьте форму и попробуйте сохранить снова.");
    return;
  }
  const task = {
    ...createDefaultTask(location.id),
    id: draft.id,
    name: draft.name,
    kind: draft.kind,
  };
  tasks.push(task);
  editorState.tab = "locations";
  editorState.locationId = location.id;
  editorState.taskLocationId = location.id;
  editorState.taskId = task.id;
  setEditorEntityView("locations", "task");
  recordEditorChange("task", task.id, "create");
  resetEntityCreateDraft("task", { locationId: location.id });
  saveEditorDraft(true);
  render();
}

export function handleEditorCreateFieldChange(input) {
  const scope = input.dataset.editorCreateScope;
  const field = input.dataset.editorCreateField;
  if (!scope || !field) return;
  const draft = getEntityCreateDraft(scope, getCreateContext(input));
  draft[field] = input.type === "checkbox" ? input.checked : input.value;
}

export function handleEditorOpenCreateForm(button) {
  openEntityCreateForm(button.dataset.editorOpenCreate, getCreateContext(button));
  renderEditor();
}

export function handleEditorCancelCreateForm(button) {
  resetEntityCreateDraft(button.dataset.editorCancelCreate, getCreateContext(button));
  renderEditor();
}

export function handleEditorCreateEntity(button) {
  const scope = button.dataset.editorCreateEntity;
  const context = getCreateContext(button);
  const draft = getEntityCreateDraft(scope, context);
  if (scope === "agent") createAgent(draft);
  if (scope === "trait") createTrait(draft);
  if (scope === "upgrade") createUpgrade(draft);
  if (scope === "event") createEvent(draft);
  if (scope === "status") createStatus(draft);
  if (scope === "activity") createActivity(draft);
  if (scope === "zone") createZone(draft);
  if (scope === "path") createPath(draft);
  if (scope === "location") createLocation(draft);
  if (scope === "task") createTask(draft, context);
}

export function handleAddTask(button) {
  const locationId = button.dataset.editorAddTask;
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;
  const task = createDefaultTask(location.id);
  tasks.push(task);
  editorState.locationId = location.id;
  editorState.taskLocationId = location.id;
  editorState.taskId = task.id;
  setEditorEntityView("locations", "task");
  recordEditorChange("task", task.id, "create");
  saveEditorDraft(true);
  render();
}

export function handleAgentTraitsMenuToggle(button) {
  const agentId = button.dataset.agentTraitsMenuToggle;
  if (!runtime.agentBlueprints.some((agent) => agent.id === agentId)) return;
  editorState.agentId = agentId;
  editorState.agentTraitMenuAgentId = editorState.agentTraitMenuAgentId === agentId ? "" : agentId;
  renderEditor();
}

export function handleAgentTraitToggle(input) {
  const agentId = input.dataset.agentTraitAgent;
  const trait = input.value;
  const blueprint = runtime.agentBlueprints.find((agent) => agent.id === agentId);
  if (!blueprint || !trait) return;

  const currentTraits = Array.isArray(blueprint.traits) ? blueprint.traits : [];
  const nextTraits = input.checked ? addTraitRef(currentTraits, trait) : removeTraitRef(currentTraits, trait);

  blueprint.traits = deepClone(nextTraits);
  syncAgentToState(agentId, "traits", nextTraits);
  editorState.agentId = agentId;
  editorState.agentTraitMenuAgentId = agentId;
  recordEditorChange("agent", agentId, "traits");
  saveEditorDraft(true);
  render();
}

function confirmDelete(label) {
  return window.confirm(`Удалить ${label}?`);
}

function normalizeResourceAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function handleUpgradeCostResourceChange(input) {
  const upgradeId = input.dataset.upgradeCostUpgrade;
  const resource = input.dataset.upgradeCostResource;
  const upgrade = upgrades.find((item) => item.id === upgradeId);
  if (!upgrade || !resource) return;
  const amount = normalizeResourceAmount(input.value);
  upgrade.cost = upgrade.cost && typeof upgrade.cost === "object" && !Array.isArray(upgrade.cost) ? { ...upgrade.cost } : {};
  if (amount === 0) delete upgrade.cost[resource];
  else upgrade.cost[resource] = amount;
  editorState.upgradeId = upgrade.id;
  recordEditorChange("upgrade", upgrade.id, "cost");
  saveEditorDraft(true);
  render();
}


function deleteAgent(agentId) {
  const agent = runtime.agentBlueprints.find((item) => item.id === agentId);
  if (!agent) return;
  if (runtime.agentBlueprints.length <= 1) {
    showToast("Нельзя удалить последнего агента.");
    return;
  }
  if (!confirmDelete(`агента «${agent.name}»`)) return;
  runtime.agentBlueprints = runtime.agentBlueprints.filter((item) => item.id !== agentId);
  state.agents = state.agents.filter((item) => item.id !== agentId);
  delete state.favors[agentId];
  delete state.completedFavors[agentId];
  const nextAgentId = runtime.agentBlueprints[0]?.id || "";
  editorState.agentId = nextAgentId;
  setEditorEntityView("agents", "list");
  if (state.selectedAgentId === agentId) state.selectedAgentId = nextAgentId;
  if (editorState.agentTraitMenuAgentId === agentId) editorState.agentTraitMenuAgentId = "";
  if (state.lastTaskRoll?.agentId === agentId) state.lastTaskRoll = null;
  recordEditorChange("agent", agentId, "delete");
  saveEditorDraft(true);
  render();
}

function isTraitUsed(traitId) {
  return runtime.agentBlueprints.some((agent) => {
    const agentTraits = Array.isArray(agent.traits) ? agent.traits : [];
    const sympathyTraits = getSympathyTraitEntries(agent).map((entry) => entry.trait);
    return [...agentTraits, ...sympathyTraits].some((traitRef) => isTraitRefSelected([traitRef], traitId));
  });
}

function deleteTrait(traitId) {
  const trait = traitCatalog.find((item) => item.id === traitId);
  if (!trait) return;
  if (isTraitUsed(trait.id)) {
    trait.disabled = true;
    editorState.traitId = trait.id;
    recordEditorChange("trait", trait.id, "disabled");
    saveEditorDraft(true);
    showToast("Черта используется агентами или sympathy-условиями, поэтому она деактивирована вместо удаления.");
    render();
    return;
  }
  if (!confirmDelete(`черту «${trait.name}»`)) return;
  traitCatalog.splice(traitCatalog.indexOf(trait), 1);
  editorState.traitId = traitCatalog[0]?.id || "";
  setEditorEntityView("traits", "list");
  recordEditorChange("trait", traitId, "delete");
  saveEditorDraft(true);
  render();
}

function hasNestedValue(value, needle) {
  if (value === needle) return true;
  if (Array.isArray(value)) return value.some((item) => hasNestedValue(item, needle));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasNestedValue(item, needle));
  return false;
}

function isUpgradeUsed(upgradeId) {
  if (state.purchasedUpgrades.includes(upgradeId)) return true;
  return tasks.some((task) =>
    ["costEffects", "rewardEffects", "successEffects", "failureEffects"].some((field) => hasNestedValue(task[field], upgradeId))
  );
}

function deleteUpgrade(upgradeId) {
  const upgrade = upgrades.find((item) => item.id === upgradeId);
  if (!upgrade) return;
  if (isUpgradeUsed(upgradeId)) {
    showToast("Апгрейд используется в игре или ссылках редактора. Сначала уберите эти ссылки.");
    return;
  }
  if (!confirmDelete(`апгрейд «${upgrade.name}»`)) return;
  upgrades.splice(upgrades.indexOf(upgrade), 1);
  editorState.upgradeId = upgrades[0]?.id || "";
  setEditorEntityView("upgrades", "list");
  recordEditorChange("upgrade", upgradeId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteEvent(eventId) {
  const event = eventDeck.find((item) => item.id === eventId);
  if (!event) return;
  if (eventDeck.length <= 1) {
    showToast("Нельзя удалить последнее событие.");
    return;
  }
  if (!confirmDelete(`событие «${event.name}»`)) return;
  eventDeck.splice(eventDeck.indexOf(event), 1);
  editorState.eventId = eventDeck[0]?.id || "";
  setEditorEntityView("events", "list");
  if (state.event?.id === eventId) state.event = null;
  recordEditorChange("event", eventId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteActivity(activityId) {
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) return;
  if (!confirmDelete(`активность «${activity.name}»`)) return;
  activities.splice(activities.indexOf(activity), 1);
  editorState.activityId = activities[0]?.id || "";
  setEditorEntityView("activities", "list");
  recordEditorChange("activity", activityId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteStatus(statusId) {
  const status = statusEffects.find((item) => item.id === statusId);
  if (!status) return;
  if (!confirmDelete(`статусный эффект «${status.name}»`)) return;
  statusEffects.splice(statusEffects.indexOf(status), 1);
  editorState.statusId = statusEffects[0]?.id || "";
  setEditorEntityView("statuses", "list");
  recordEditorChange("status", statusId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteZone(zoneId) {
  const zone = zones.find((item) => item.id === zoneId);
  if (!zone) return;
  if (zones.length <= 1) {
    showToast("Нельзя удалить последнюю зону.");
    return;
  }
  if (locations.some((location) => location.zoneId === zoneId)) {
    showToast("Сначала удалите или переназначьте локации этой зоны.");
    return;
  }
  if (paths.some((path) => path.a === zoneId || path.b === zoneId)) {
    showToast("Сначала удалите пути, связанные с этой зоной.");
    return;
  }
  if (!confirmDelete(`зону «${zone.name}»`)) return;
  zones.splice(zones.indexOf(zone), 1);
  editorState.zoneId = zones[0]?.id || "";
  setEditorEntityView("zones", editorState.zoneId ? "edit" : "list");
  if (runtime.zoneLabelDragZoneId === zoneId) runtime.zoneLabelDragZoneId = "";
  recordEditorChange("zone", zoneId, "delete");
  saveEditorDraft(true);
  render();
}

function deletePath(pathId, keepZoneId = "") {
  const path = paths.find((item) => item.id === pathId);
  if (!path) return;
  if (!confirmDelete(`путь «${path.name}»`)) return;
  paths.splice(paths.indexOf(path), 1);
  if (keepZoneId && zones.some((zone) => zone.id === keepZoneId)) {
    editorState.tab = "zones";
    editorState.zoneId = keepZoneId;
    setEditorEntityView("zones", "edit");
  } else {
    editorState.pathId = paths[0]?.id || "";
    setEditorEntityView("paths", "list");
  }
  runtime.pathEndpointEditMode = false;
  recordEditorChange("path", pathId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;
  if (locations.length <= 1) {
    showToast("Нельзя удалить последнюю локацию.");
    return;
  }
  if (runtime.agentBlueprints.some((agent) => agent.locationId === locationId || agent.startLocationId === locationId)) {
    showToast("Сначала переназначьте агентов из этой локации.");
    return;
  }
  if (state.agents.some((agent) => agent.locationId === locationId || agent.startLocationId === locationId)) {
    showToast("Сначала переназначьте агентов из этой локации.");
    return;
  }
  if (!confirmDelete(`локацию «${location.name}» и её задачи`)) return;
  const removedTasks = tasks.filter((task) => task.locationId === locationId);
  removedTasks.forEach((task) => {
    delete state.taskUses[task.id];
    if (state.lastTaskRoll?.taskId === task.id) state.lastTaskRoll = null;
    recordEditorChange("task", task.id, "delete");
  });
  tasks.splice(0, tasks.length, ...tasks.filter((task) => task.locationId !== locationId));
  locations.splice(locations.indexOf(location), 1);
  const nextLocationId = locations[0]?.id || "";
  editorState.locationId = nextLocationId;
  editorState.taskLocationId = nextLocationId;
  selectFirstTaskForLocation(nextLocationId);
  setEditorEntityView("locations", "list");
  if (state.selectedLocationId === locationId) {
    state.selectedLocationId = nextLocationId;
    state.locationPanelOpen = Boolean(nextLocationId);
  }
  recordEditorChange("location", locationId, "delete");
  saveEditorDraft(true);
  render();
}

function deleteTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  if (!confirmDelete(`задачу «${task.name}»`)) return;
  tasks.splice(tasks.indexOf(task), 1);
  delete state.taskUses[taskId];
  if (state.lastTaskRoll?.taskId === taskId) state.lastTaskRoll = null;
  editorState.locationId = task.locationId;
  editorState.taskLocationId = task.locationId;
  selectFirstTaskForLocation(task.locationId);
  setEditorEntityView("locations", "location");
  recordEditorChange("task", taskId, "delete");
  saveEditorDraft(true);
  render();
}

export function handleEditorDeleteEntity(button) {
  const scope = button.dataset.editorDeleteEntity;
  const id = button.dataset.editorDeleteId;
  if (scope === "agent") deleteAgent(id);
  if (scope === "trait") deleteTrait(id);
  if (scope === "upgrade") deleteUpgrade(id);
  if (scope === "event") deleteEvent(id);
  if (scope === "status") deleteStatus(id);
  if (scope === "activity") deleteActivity(id);
  if (scope === "zone") deleteZone(id);
  if (scope === "path") deletePath(id, button.dataset.editorDeleteKeepZone || "");
  if (scope === "location") deleteLocation(id);
  if (scope === "task") deleteTask(id);
}

export function handleMainCharacterChange(select) {
  const nextMainCharacterId = select.value;
  if (nextMainCharacterId && !runtime.agentBlueprints.some((agent) => agent.id === nextMainCharacterId)) return;

  const currentMainCharacterId = runtime.agentBlueprints.find((agent) => agent.isMainCharacter)?.id || "";
  runtime.agentBlueprints.forEach((agent) => {
    agent.isMainCharacter = agent.id === nextMainCharacterId;
  });
  state.agents.forEach((agent) => {
    agent.isMainCharacter = agent.id === nextMainCharacterId;
  });
  recordEditorChange("agent", nextMainCharacterId || currentMainCharacterId, "mainCharacter");
  saveEditorDraft(true);
  render();
}

function setAgentSympathyTraits(agentId, entries) {
  const blueprint = runtime.agentBlueprints.find((agent) => agent.id === agentId);
  if (!blueprint) return false;
  const nextTraits = entries.map((entry) => normalizeSympathyTraitEntry(entry));
  blueprint.sympathyTraits = deepClone(nextTraits);
  syncAgentToState(agentId, "sympathyTraits", nextTraits);
  editorState.agentId = agentId;
  recordEditorChange("agent", agentId, "sympathyTraits");
  saveEditorDraft(true);
  render();
  return true;
}

export function handleAddAgentSympathyTrait(button) {
  const agentId = button.dataset.agentSympathyTraitAdd;
  const blueprint = runtime.agentBlueprints.find((agent) => agent.id === agentId);
  if (!blueprint) return;
  const entries = getSympathyTraitEntries(blueprint, { includeEmpty: true });
  entries.push({
    section: getNextSympathyTraitSection(blueprint),
    trait: getDefaultSympathyTraitRef(),
  });
  setAgentSympathyTraits(agentId, entries);
}

export function handleRemoveAgentSympathyTrait(button) {
  const agentId = button.dataset.agentSympathyTraitRemove;
  const index = Number(button.dataset.agentSympathyTraitIndex);
  const blueprint = runtime.agentBlueprints.find((agent) => agent.id === agentId);
  if (!blueprint || !Number.isInteger(index)) return;
  const entries = getSympathyTraitEntries(blueprint, { includeEmpty: true }).filter((_, itemIndex) => itemIndex !== index);
  setAgentSympathyTraits(agentId, entries);
}

export function handleAgentSympathyTraitFieldChange(input) {
  const agentId = input.dataset.agentSympathyTraitAgent;
  const index = Number(input.dataset.agentSympathyTraitIndex);
  const field = input.dataset.agentSympathyTraitField;
  const blueprint = runtime.agentBlueprints.find((agent) => agent.id === agentId);
  if (!blueprint || !Number.isInteger(index) || !["section", "trait"].includes(field)) return;

  const entries = getSympathyTraitEntries(blueprint, { includeEmpty: true });
  if (!entries[index]) return;
  entries[index] = {
    ...entries[index],
    [field]: field === "section" ? Number(input.value) || 0 : input.value,
  };
  setAgentSympathyTraits(agentId, entries);
}

export function handleZoneLabelDragMode(button) {
  const zoneId = button.dataset.zoneLabelDragMode;
  const zone = zones.find((item) => item.id === zoneId);
  if (!zone) return;
  editorState.tab = "zones";
  editorState.zoneId = zone.id;
  runtime.pathEndpointEditMode = false;
  runtime.zoneLabelDragZoneId = runtime.zoneLabelDragZoneId === zone.id ? "" : zone.id;
  render();
}

function getPathZones(path) {
  return {
    zoneA: zones.find((zone) => zone.id === path.a),
    zoneB: zones.find((zone) => zone.id === path.b),
  };
}

function resetEditedPathEndpoints(path) {
  const { zoneA, zoneB } = getPathZones(path);
  resetPathEndpoints(path, zoneA, zoneB);
  if (isPathBendEnabled(path)) resetPathBend(path, getPathEndpoints(path, zoneA, zoneB));
  else path.bend = null;
}

function snapEditedPathEndpoint(path, field) {
  const endpoint = field.startsWith("from.") ? "from" : field.startsWith("to.") ? "to" : "";
  if (!endpoint || !path[endpoint]) return;
  const { zoneA, zoneB } = getPathZones(path);
  snapPathEndpoint(path, endpoint, path[endpoint], zoneA, zoneB);
}

function setEditedPathBend(path) {
  if (!path.bend) return;
  const { zoneA, zoneB } = getPathZones(path);
  setPathBend(path, getPathBend(path, getPathEndpoints(path, zoneA, zoneB)));
}

function syncPathBendToggle(path, enabled) {
  path.bendEnabled = enabled;
  if (enabled) {
    const { zoneA, zoneB } = getPathZones(path);
    if (!path.bend) resetPathBend(path, getPathEndpoints(path, zoneA, zoneB));
  } else {
    path.bend = null;
  }
}

export function handleEditorFieldChange(input) {
  const scope = input.dataset.editScope;
  const id = input.dataset.editId;
  const field = input.dataset.editField;
  if (!scope || !id || !field) return;

  let value;
  try {
    value = normalizeEditorValue(input);
  } catch (error) {
    showToast(error.message || "JSON в поле некорректен.");
    return;
  }

  if (scope === "agent") {
    const blueprint = runtime.agentBlueprints.find((agent) => agent.id === id);
    if (!blueprint) return;
    setNestedValue(blueprint, field, deepClone(value));
    syncAgentToState(id, field, value);
  } else if (scope === "trait") {
    const trait = traitCatalog.find((item) => item.id === id);
    if (!trait) return;
    if ((field === "name" || field === "category") && !String(value).trim()) {
      showToast("Черта: название и категория обязательны.");
      return;
    }
    setNestedValue(trait, field, deepClone(value));
    editorState.traitId = id;
  } else if (scope === "upgrade") {
    const upgrade = upgrades.find((item) => item.id === id);
    if (!upgrade) return;
    if (field === "name" && !String(value).trim()) {
      showToast("Апгрейд: название обязательно.");
      return;
    }
    setNestedValue(upgrade, field, deepClone(value));
    editorState.upgradeId = id;
  } else if (scope === "event") {
    const event = eventDeck.find((item) => item.id === id);
    if (!event) return;
    if (field === "name" && !String(value).trim()) {
      showToast("Событие: название обязательно.");
      return;
    }
    setNestedValue(event, field, deepClone(value));
    editorState.eventId = id;
  } else if (scope === "status") {
    const status = statusEffects.find((item) => item.id === id);
    if (!status) return;
    if (field === "name" && !String(value).trim()) {
      showToast("Статусный эффект: название обязательно.");
      return;
    }
    setNestedValue(status, field, deepClone(value));
    if (["duration", "maxStacks"].includes(field)) status[field] = Math.max(1, Math.trunc(Number(value)) || 1);
    editorState.statusId = id;
  } else if (scope === "activity") {
    const activity = activities.find((item) => item.id === id);
    if (!activity) return;
    if (field === "name" && !String(value).trim()) {
      showToast("Активность: название обязательно.");
      return;
    }
    setNestedValue(activity, field, deepClone(value));
    editorState.activityId = id;
  } else if (scope === "zone") {
    const zone = zones.find((item) => item.id === id);
    if (!zone) return;
    setNestedValue(zone, field, field === "points" ? formatZonePoints(value) : value);
    if (field === "points" || field.startsWith("labelPosition.")) {
      zone.labelPosition = clampZoneLabelPosition(zone, zone.labelPosition || zone.center);
    }
  } else if (scope === "path") {
    const edge = paths.find((item) => item.id === id);
    if (!edge) return;
    if (field === "tollEnabled") {
      edge.toll = value ? createPathToll(getPathTollResource(edge), getPathTollAmount(edge)) : {};
    } else if (field === "tollResource") {
      edge.toll = createPathToll(value, getPathTollAmount(edge));
    } else if (field === "tollAmount") {
      edge.toll = createPathToll(getPathTollResource(edge), value);
    } else {
      setNestedValue(edge, field, value);
    }
    if (field === "enabled") setPathEnabled(edge.id, value);
    if (field === "bendEnabled") syncPathBendToggle(edge, value);
    if (field === "a" || field === "b") resetEditedPathEndpoints(edge);
    if (field.startsWith("from.") || field.startsWith("to.")) snapEditedPathEndpoint(edge, field);
    if (field.startsWith("bend.")) {
      edge.bendEnabled = true;
      setEditedPathBend(edge);
    }
  } else if (scope === "location") {
    const location = locations.find((item) => item.id === id);
    if (!location) return;
    setNestedValue(location, field, value);
  } else if (scope === "task") {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setNestedValue(task, field, value);
    if (field === "difficultyLevelId") task.difficultyLevelId = String(value || "");
    editorState.taskId = id;
    if (field === "locationId") {
      editorState.locationId = value;
      editorState.taskLocationId = value;
    }
  } else if (scope === "resource") {
    runtime.initialResources[field] = value;
    state.resources[field] = value;
  } else if (scope === "bar") {
    runtime.barSettings[field] = value;
    state.barSettings[field] = value;
  }

  recordEditorChange(scope, id, field);
  saveEditorDraft(true);
  render();
}

export function handleEditorPickerChange(select) {
  const kind = select.dataset.editorPicker;
  if (kind === "agent") {
    editorState.agentId = select.value;
    editorState.agentTraitMenuAgentId = "";
    setEditorEntityView("agents", "edit");
  }
  if (kind === "trait") {
    editorState.traitId = select.value;
    setEditorEntityView("traits", "edit");
  }
  if (kind === "upgrade") {
    editorState.upgradeId = select.value;
    setEditorEntityView("upgrades", "edit");
  }
  if (kind === "event") {
    editorState.eventId = select.value;
    setEditorEntityView("events", "edit");
  }
  if (kind === "status") {
    editorState.statusId = select.value;
    setEditorEntityView("statuses", "edit");
  }
  if (kind === "activity") {
    editorState.activityId = select.value;
    setEditorEntityView("activities", "edit");
  }
  if (kind === "zone") {
    editorState.zoneId = select.value;
    setEditorEntityView("zones", "edit");
    runtime.pathEndpointEditMode = false;
    if (runtime.zoneLabelDragZoneId && runtime.zoneLabelDragZoneId !== select.value) {
      runtime.zoneLabelDragZoneId = "";
    }
  }
  if (kind === "path") {
    editorState.pathId = select.value;
    setEditorEntityView("paths", "edit");
    runtime.zoneLabelDragZoneId = "";
    render();
    return;
  }
  if (kind === "location") {
    editorState.locationId = select.value;
    editorState.taskLocationId = select.value;
    editorState.taskId = tasks.find((task) => task.locationId === select.value)?.id || "";
    setEditorEntityView("locations", "location");
  }
  if (kind === "task-location") {
    editorState.locationId = select.value;
    editorState.taskLocationId = select.value;
    editorState.taskId = tasks.find((task) => task.locationId === select.value)?.id || "";
    setEditorEntityView("locations", "location");
  }
  if (kind === "task") {
    editorState.taskId = select.value;
    setEditorEntityView("locations", "task");
  }
  renderEditor();
}

export function handleEditorSelectEntity(button) {
  const scope = button.dataset.editorSelectEntity;
  const id = button.dataset.editorSelectId;
  if (scope === "agent" && runtime.agentBlueprints.some((agent) => agent.id === id)) {
    editorState.tab = "agents";
    editorState.agentId = id;
    editorState.agentTraitMenuAgentId = "";
    setEditorEntityView("agents", "edit");
  }
  if (scope === "trait" && traitCatalog.some((trait) => trait.id === id)) {
    editorState.tab = "traits";
    editorState.traitId = id;
    setEditorEntityView("traits", "edit");
  }
  if (scope === "upgrade" && upgrades.some((upgrade) => upgrade.id === id)) {
    editorState.tab = "upgrades";
    editorState.upgradeId = id;
    setEditorEntityView("upgrades", "edit");
  }
  if (scope === "event" && eventDeck.some((event) => event.id === id)) {
    editorState.tab = "events";
    editorState.eventId = id;
    setEditorEntityView("events", "edit");
  }
  if (scope === "status" && statusEffects.some((status) => status.id === id)) {
    editorState.tab = "statuses";
    editorState.statusId = id;
    setEditorEntityView("statuses", "edit");
  }
  if (scope === "activity" && activities.some((activity) => activity.id === id)) {
    editorState.tab = "activities";
    editorState.activityId = id;
    setEditorEntityView("activities", "edit");
  }
  if (scope === "zone" && zones.some((zone) => zone.id === id)) {
    editorState.tab = "zones";
    editorState.zoneId = id;
    runtime.pathEndpointEditMode = false;
    setEditorEntityView("zones", "edit");
  }
  if (scope === "path" && paths.some((path) => path.id === id)) {
    editorState.tab = "paths";
    editorState.pathId = id;
    runtime.zoneLabelDragZoneId = "";
    setEditorEntityView("paths", "edit");
  }
  if (scope === "location" && locations.some((location) => location.id === id)) {
    editorState.tab = "locations";
    editorState.locationId = id;
    editorState.taskLocationId = id;
    editorState.taskId = "";
    setEditorEntityView("locations", "location");
  }
  if (scope === "task") {
    const task = tasks.find((item) => item.id === id);
    if (task) {
      editorState.tab = "locations";
      editorState.locationId = task.locationId;
      editorState.taskLocationId = task.locationId;
      editorState.taskId = task.id;
      setEditorEntityView("locations", "task");
    }
  }
  render();
}

export function handleEditorBack(button) {
  const scope = button.dataset.editorBack;
  const target = button.dataset.editorBackTarget || "list";
  if (scope === "locations") {
    if (target === "location" && locations.some((location) => location.id === editorState.locationId)) {
      editorState.taskId = "";
      setEditorEntityView("locations", "location");
    } else {
      editorState.taskId = "";
      setEditorEntityView("locations", "list");
    }
  } else {
    setEditorEntityView(scope, "list");
  }
  if (scope !== "paths") runtime.pathEndpointEditMode = false;
  if (scope !== "zones") runtime.zoneLabelDragZoneId = "";
  render();
}
