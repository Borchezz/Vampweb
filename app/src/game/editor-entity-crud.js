import { editorState, runtime } from "./state.js";
import { activities, eventDeck, locations, statusEffects, tasks, traitCatalog, upgrades, zones } from "./data.js";

function getNextId(prefix, items) {
  let index = items.length + 1;
  let id = `${prefix}-${index}`;
  while (items.some((item) => item.id === id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function getTaskDraftId(locationId) {
  let index = tasks.filter((task) => task.locationId === locationId).length + 1;
  let id = `${locationId}-task-${index}`;
  while (tasks.some((task) => task.id === id)) {
    index += 1;
    id = `${locationId}-task-${index}`;
  }
  return id;
}

function getDraftKey(scope, context = {}) {
  return scope === "task" ? `task:${context.locationId || ""}` : scope;
}

export function createDefaultEntityDraft(scope, context = {}) {
  if (scope === "agent") {
    const locationId = locations[0]?.id || "";
    return {
      id: getNextId("agent", runtime.agentBlueprints),
      name: "Новый агент",
      role: "Новичок",
      locationId,
    };
  }

  if (scope === "zone") {
    return {
      id: getNextId("zone", zones),
      name: "Новая зона",
      code: "НЗ",
    };
  }

  if (scope === "trait") {
    return {
      id: getNextId("trait", traitCatalog),
      name: "Новая черта",
      category: "custom",
      tags: "",
    };
  }

  if (scope === "upgrade") {
    return {
      id: getNextId("upgrade", upgrades),
      name: "Новый апгрейд",
    };
  }

  if (scope === "event") {
    return {
      id: getNextId("event", eventDeck),
      name: "Новое событие",
    };
  }

  if (scope === "status") {
    return { id: getNextId("status", statusEffects), name: "Новый статусный эффект" };
  }

  if (scope === "activity") {
    return { id: getNextId("activity", activities), name: "Новая активность", kind: "solo" };
  }

  if (scope === "path") {
    return {
      type: "border",
      a: zones[0]?.id || "",
      b: zones[1]?.id || "",
    };
  }

  if (scope === "location") {
    return {
      id: getNextId("location", locations),
      name: "Новая локация",
      zoneId: zones.find((zone) => zone.id === editorState.zoneId)?.id || zones[0]?.id || "",
      symbol: "НЛ",
    };
  }

  if (scope === "task") {
    const locationId = context.locationId || locations[0]?.id || "";
    return {
      id: getTaskDraftId(locationId),
      locationId,
      name: "Новая задача",
      kind: "check",
      stat: "none",
    };
  }

  return {};
}

export function getEntityCreateDraft(scope, context = {}) {
  const key = getDraftKey(scope, context);
  if (!editorState.createDrafts[key]) {
    editorState.createDrafts[key] = createDefaultEntityDraft(scope, context);
  }
  return editorState.createDrafts[key];
}

export function isEntityCreateFormOpen(scope, context = {}) {
  return Boolean(editorState.createForms[getDraftKey(scope, context)]);
}

export function openEntityCreateForm(scope, context = {}) {
  const key = getDraftKey(scope, context);
  getEntityCreateDraft(scope, context);
  editorState.createForms[key] = true;
}

export function resetEntityCreateDraft(scope, context = {}) {
  const key = getDraftKey(scope, context);
  delete editorState.createDrafts[key];
  delete editorState.createForms[key];
}
