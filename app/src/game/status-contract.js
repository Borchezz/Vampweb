import { deepClone } from "./utils.js";
import { normalizeStatusEffectList } from "./status-effect-registry.js";

export const STATUS_FIELD_KEYS = ["id", "name", "description", "duration", "maxStacks", "effects"];

function normalizeId(value, fallback = "status") {
  return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function normalizeStatusEntry(status = {}, fallbackId = "status") {
  return {
    id: normalizeId(status.id || status.name, fallbackId),
    name: String(status.name || status.id || fallbackId).trim(),
    description: String(status.description || "").trim(),
    duration: positiveInteger(status.duration, 1),
    maxStacks: positiveInteger(status.maxStacks, 1),
    effects: normalizeStatusEffectList(status.effects),
  };
}

export function serializeStatus(status) {
  return deepClone(normalizeStatusEntry(status, status?.id || "status"));
}
