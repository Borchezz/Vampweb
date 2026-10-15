import { deepClone } from "./utils.js";
import { normalizeActivityEffectList } from "./activity-effect-registry.js";

export const ACTIVITY_KIND_OPTIONS = [
  { value: "solo", label: "Одиночная" },
  { value: "pair", label: "Парная" },
  { value: "group", label: "Групповая" },
];

export const ACTIVITY_FIELD_KEYS = ["id", "name", "description", "resultDescription", "kind", "effects"];
export const RUNTIME_ACTIVITY_FIELD_KEYS = [...ACTIVITY_FIELD_KEYS];

function normalizeActivityId(value, fallback = "activity") {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function normalizeActivityKind(value) {
  const kind = String(value || "").trim();
  return ACTIVITY_KIND_OPTIONS.some((option) => option.value === kind) ? kind : "solo";
}

export function normalizeActivityEntry(activity = {}, fallbackId = "activity") {
  const kind = normalizeActivityKind(activity.kind);
  return {
    id: normalizeActivityId(activity.id || activity.name, fallbackId),
    name: String(activity.name || activity.id || fallbackId).trim(),
    description: String(activity.description || "").trim(),
    resultDescription: String(activity.resultDescription || "").trim(),
    kind,
    effects: normalizeActivityEffectList(activity.effects),
  };
}

export function serializeActivity(activity) {
  return deepClone(normalizeActivityEntry(activity, activity?.id || "activity"));
}
