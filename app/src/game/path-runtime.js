import { paths } from "./data.js";
import { state } from "./state.js";

function getDefaultPathState(path) {
  return {
    enabled: path?.enabled !== false,
    energyDelta: 0,
  };
}

function getStoredPathState(path) {
  const stored = state.pathStates?.[path.id];
  return {
    ...getDefaultPathState(path),
    ...(stored && typeof stored === "object" ? stored : {}),
  };
}

export function initializePathStates(targetState) {
  targetState.pathStates = Object.fromEntries(paths.map((path) => [path.id, getDefaultPathState(path)]));
}

export function isPathEnabled(path) {
  if (!path) return false;
  return getStoredPathState(path).enabled !== false;
}

export function getPathEnergy(path) {
  if (!path) return 0;
  const baseEnergy = Number(path.energy) || 0;
  const energyDelta = Number(getStoredPathState(path).energyDelta) || 0;
  return Math.max(0, baseEnergy + energyDelta);
}

export function setPathEnabled(pathId, enabled) {
  const path = paths.find((item) => item.id === pathId);
  if (!path) return false;
  state.pathStates = state.pathStates || {};
  state.pathStates[path.id] = {
    ...getStoredPathState(path),
    enabled: Boolean(enabled),
  };
  return true;
}

export function adjustPathEnergy(pathId, amount) {
  const path = paths.find((item) => item.id === pathId);
  if (!path) return false;
  const delta = Number(amount);
  if (!Number.isFinite(delta)) return false;
  state.pathStates = state.pathStates || {};
  const current = getStoredPathState(path);
  state.pathStates[path.id] = {
    ...current,
    energyDelta: current.energyDelta + delta,
  };
  return true;
}
