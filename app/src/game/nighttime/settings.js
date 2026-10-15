const STORAGE_KEY = "bloodbar-nighttime-settings";
export const DEFAULT_NIGHTTIME_SETTINGS = {
  preferenceMin: 6,
  preferenceMax: 7,
  filmCombinationMode: "linked",
  resourceLimited: true,
  resourceRandomMin: 0,
  resourceRandomMax: 3,
  satisfactionLikeBase: 2,
  satisfactionStronglyLikeBase: 4,
  balancedPreferences: false,
};
let settings = { ...DEFAULT_NIGHTTIME_SETTINGS };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
} catch {
  settings = { ...DEFAULT_NIGHTTIME_SETTINGS };
}

export function getNighttimeSettings() {
  return { ...settings };
}

export function updateNighttimeSettings(patch) {
  const min = Math.max(1, Math.min(12, Math.trunc(Number(patch.preferenceMin ?? settings.preferenceMin)) || 1));
  const max = Math.max(min, Math.min(12, Math.trunc(Number(patch.preferenceMax ?? settings.preferenceMax)) || min));
  const resourceRandomMin = Math.max(0, Math.min(99, Math.trunc(Number(patch.resourceRandomMin ?? settings.resourceRandomMin)) || 0));
  const resourceRandomMax = Math.max(resourceRandomMin, Math.min(99, Math.trunc(Number(patch.resourceRandomMax ?? settings.resourceRandomMax)) || resourceRandomMin));
  const satisfactionLikeBase = Math.max(0, Math.min(99, Number(patch.satisfactionLikeBase ?? settings.satisfactionLikeBase) || 0));
  const satisfactionStronglyLikeBase = Math.max(0, Math.min(99, Number(patch.satisfactionStronglyLikeBase ?? settings.satisfactionStronglyLikeBase) || 0));
  settings = {
    preferenceMin: min,
    preferenceMax: max,
    filmCombinationMode: patch.filmCombinationMode === "all" ? "all" : "linked",
    resourceLimited: patch.resourceLimited ?? settings.resourceLimited,
    resourceRandomMin,
    resourceRandomMax,
    satisfactionLikeBase,
    satisfactionStronglyLikeBase,
    balancedPreferences: patch.balancedPreferences ?? settings.balancedPreferences,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Node unit tests and restricted browser contexts keep settings in memory.
  }
  return getNighttimeSettings();
}
