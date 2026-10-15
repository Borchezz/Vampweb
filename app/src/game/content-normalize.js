import { clampZoneLabelPosition } from "./map-utils.js";
import { applyTaskFields, normalizeTaskEntry } from "./task-contract.js";

export function hasOwnConfigField(config, field) {
  return Object.prototype.hasOwnProperty.call(config, field);
}

export function normalizeLoadedZone(zone) {
  const normalized = { ...zone };
  return {
    ...normalized,
    labelPosition: clampZoneLabelPosition(normalized, normalized.labelPosition || normalized.center),
  };
}

export function normalizeLoadedPath(edge) {
  const bendEnabled = hasOwnConfigField(edge, "bendEnabled") ? Boolean(edge.bendEnabled) : Boolean(edge.bend);
  const normalized = { ...edge };
  delete normalized.lockedBy;
  return {
    ...normalized,
    enabled: normalized.enabled !== false,
    bendEnabled,
    bend: bendEnabled ? normalized.bend || null : null,
  };
}

export function createTaskFromConfig(savedTask, options = {}) {
  return normalizeTaskEntry(savedTask, options);
}

export function applySavedTaskFields(task, savedTask) {
  return applyTaskFields(task, savedTask);
}
