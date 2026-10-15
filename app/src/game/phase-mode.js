export const PHASE_MODE_IDS = ["full", "daytime", "nighttime"];

export const PHASE_MODE = {
  full: "full",
  daytime: "daytime",
  nighttime: "nighttime",
};

export function normalizePhaseMode(value) {
  return PHASE_MODE_IDS.includes(value) ? value : PHASE_MODE.full;
}

export function getPhaseMode(search = globalThis.location?.search || "") {
  const params = new URLSearchParams(search);
  return normalizePhaseMode(params.get("mode"));
}

export function isDaytimeEnabled(mode) {
  return mode === PHASE_MODE.full || mode === PHASE_MODE.daytime;
}

export function isNighttimeEnabled(mode) {
  return mode === PHASE_MODE.full || mode === PHASE_MODE.nighttime;
}

export function getPhaseModeUrl(mode, location = globalThis.location) {
  const url = new URL(location.href);
  url.searchParams.set("mode", normalizePhaseMode(mode));
  return url.toString();
}
