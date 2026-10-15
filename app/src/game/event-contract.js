import { normalizeEventEffectList } from "./event-effect-registry.js";

export const EVENT_FIELD_KEYS = ["id", "name", "description", "effects"];
export const RUNTIME_EVENT_FIELD_KEYS = [...EVENT_FIELD_KEYS];

function normalizeEventId(value, fallback = "event") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

export function normalizeEventEntry(event = {}, fallbackId = "event") {
  return {
    id: normalizeEventId(event.id || event.name, fallbackId),
    name: String(event.name || event.id || fallbackId).trim(),
    description: String(event.description || "").trim(),
    effects: normalizeEventEffectList(event.effects),
  };
}

export function serializeEvent(event) {
  return normalizeEventEntry(event, event?.id || "event");
}
