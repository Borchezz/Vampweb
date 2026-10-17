import { TAG_DEFINITIONS, tagSupportsDegree } from "./cocktail-data.js";
import { getNighttimeSettings } from "./settings.js";

export const PREFERENCE_ATTITUDE = {
  stronglyDislike: -2,
  dislike: -1,
  indifferent: 0,
  like: 1,
  stronglyLike: 2,
};

export const PREFERENCE_ATTITUDE_LABEL = {
  [PREFERENCE_ATTITUDE.stronglyDislike]: "Совсем не хочет",
  [PREFERENCE_ATTITUDE.dislike]: "Не хочет",
  [PREFERENCE_ATTITUDE.indifferent]: "Всё равно",
  [PREFERENCE_ATTITUDE.like]: "Хочет",
  [PREFERENCE_ATTITUDE.stronglyLike]: "Очень хочет",
};

const preference = (tagId, attitude, degree = 1) => {
  const numeric = Number(degree);
  const normalized = Number.isFinite(numeric) ? Math.max(1, Math.trunc(numeric)) : 1;
  return tagSupportsDegree(tagId) ? { tagId, attitude, degree: normalized } : { tagId, attitude };
};

export const PREFERENCE_PROFILES = [
  {
    id: "night-owl",
    name: "Ночная сова",
    preferences: [preference("sweet", 2), preference("cold", 1), preference("hemolysis", -2), preference("healing", 1), preference("bitter", -1), preference("layered", -1), preference("bloodAB", 1)],
  },
  {
    id: "old-guard",
    name: "Старая гвардия",
    preferences: [preference("bitter", 1), preference("warm", 2), preference("liquid", -1), preference("potential", 1), preference("healing", -2), preference("mixed", -1), preference("bloodO", 2)],
  },
];
const CLIENTS_STORAGE_KEY = "bloodbar-nighttime-clients";
let editableClients = null;

function normalizeClient(client) {
  return { id: String(client?.id || "").trim(), name: String(client?.name || "").trim(), preferences: Array.isArray(client?.preferences) ? client.preferences.filter((item) => TAG_DEFINITIONS[item?.tagId] && [-2, -1, 1, 2].includes(item.attitude)).map((item) => preference(item.tagId, item.attitude, item.degree)) : [] };
}
export function getClients() {
  if (editableClients) return editableClients;
  try { editableClients = JSON.parse(localStorage.getItem(CLIENTS_STORAGE_KEY) || "null")?.map(normalizeClient).filter((client) => client.id && client.name) || PREFERENCE_PROFILES.map(normalizeClient); } catch { editableClients = PREFERENCE_PROFILES.map(normalizeClient); }
  return editableClients;
}
export function setClients(clients) {
  editableClients = clients.map(normalizeClient).filter((client) => client.id && client.name);
  try { localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(editableClients)); } catch { /* local editing remains available */ }
  window.dispatchEvent(new Event("nighttime-clients-changed"));
}
export function createClient() {
  const index = getClients().length + 1;
  setClients([...getClients(), { id: `client-${index}`, name: `Клиент ${index}`, preferences: [] }]);
}
export function deleteClient(clientId) {
  setClients(getClients().filter((client) => client.id !== clientId));
}
export function getRandomStoredClient(random = Math.random, excludedClientIds = []) {
  const excluded = new Set(excludedClientIds);
  const availableClients = getClients().filter((client) => !excluded.has(client.id));
  return availableClients.length ? availableClients[Math.floor(random() * availableClients.length)] : null;
}

export const GENERATABLE_TAG_IDS = Object.keys(TAG_DEFINITIONS);
const BLOOD_GROUP_TAG_IDS = ["bloodO", "bloodA", "bloodB", "bloodAB"];
export const MUTUALLY_EXCLUSIVE_PREFERENCE_TAG_GROUPS = [["cold", "warm"], ["layered", "mixed"]];

function randomItem(items, random) {
  return items[Math.floor(random() * items.length)];
}

export function getRandomPreferenceDegree(random = Math.random) {
  const roll = random();
  if (roll < 0.5) return 1;
  if (roll < 0.85) return 2;
  return 3;
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function areMutuallyExclusive(firstTagId, secondTagId) {
  return MUTUALLY_EXCLUSIVE_PREFERENCE_TAG_GROUPS.some((tagGroup) => tagGroup.includes(firstTagId) && tagGroup.includes(secondTagId));
}

function selectCompatibleTags(tagIds, count, random) {
  return shuffled(tagIds, random).reduce((selected, tagId) => {
    if (selected.length >= count || selected.some((selectedTagId) => areMutuallyExclusive(selectedTagId, tagId))) return selected;
    selected.push(tagId);
    return selected;
  }, []);
}

export function createRandomPreferenceProfile(random = Math.random) {
  const settings = getNighttimeSettings();
  const preferenceCount = Math.max(settings.balancedPreferences ? 4 : 1, settings.preferenceMin + Math.floor(random() * (settings.preferenceMax - settings.preferenceMin + 1)));
  const nonBloodTagIds = GENERATABLE_TAG_IDS.filter((tagId) => !BLOOD_GROUP_TAG_IDS.includes(tagId));
  const tagIds = [randomItem(BLOOD_GROUP_TAG_IDS, random), ...selectCompatibleTags(nonBloodTagIds, preferenceCount - 1, random)];
  const attitudes = [PREFERENCE_ATTITUDE.stronglyDislike, PREFERENCE_ATTITUDE.dislike, PREFERENCE_ATTITUDE.like, PREFERENCE_ATTITUDE.stronglyLike];
  const preferenceAttitudes = settings.balancedPreferences
    ? shuffled([...attitudes, ...Array.from({ length: preferenceCount - attitudes.length }, () => randomItem(attitudes, random))], random)
    : tagIds.map(() => randomItem(attitudes, random));
  return {
    id: "generated-" + Math.floor(random() * 1_000_000),
    name: "Ночной гость",
    preferences: tagIds.map((tagId, index) => {
      const attitude = preferenceAttitudes[index];
      return preference(tagId, attitude, getRandomPreferenceDegree(random));
    }),
  };
}
