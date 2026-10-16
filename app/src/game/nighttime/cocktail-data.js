export const TAG_CATEGORY = {
  flavor: "flavor", bloodGroup: "blood-group", benefit: "benefit", composition: "composition", serving: "serving",
};
export const TAG_DEFINITIONS = {
  salty: { id: "salty", label: "Солёное", category: TAG_CATEGORY.flavor }, sweet: { id: "sweet", label: "Сладкое", category: TAG_CATEGORY.flavor }, sour: { id: "sour", label: "Кислое", category: TAG_CATEGORY.flavor }, bitter: { id: "bitter", label: "Горькое", category: TAG_CATEGORY.flavor },
  bloodO: { id: "bloodO", label: "I (O)", category: TAG_CATEGORY.bloodGroup }, bloodA: { id: "bloodA", label: "II (A)", category: TAG_CATEGORY.bloodGroup }, bloodB: { id: "bloodB", label: "III (B)", category: TAG_CATEGORY.bloodGroup }, bloodAB: { id: "bloodAB", label: "IV (AB)", category: TAG_CATEGORY.bloodGroup },
  invigorating: { id: "invigorating", label: "Бодрящее", category: TAG_CATEGORY.benefit }, healing: { id: "healing", label: "Целебное", category: TAG_CATEGORY.benefit }, potential: { id: "potential", label: "Потенциал", category: TAG_CATEGORY.benefit },
  liquid: { id: "liquid", label: "Жидкое", category: TAG_CATEGORY.composition }, thick: { id: "thick", label: "Густое", category: TAG_CATEGORY.composition }, hemolysis: { id: "hemolysis", label: "Гемолиз", category: TAG_CATEGORY.composition },
  cold: { id: "cold", label: "Холодный", category: TAG_CATEGORY.serving }, warm: { id: "warm", label: "Тёплый", category: TAG_CATEGORY.serving }, layered: { id: "layered", label: "Слоистый", category: TAG_CATEGORY.serving }, mixed: { id: "mixed", label: "Смешанный", category: TAG_CATEGORY.serving },
};
export const NON_SCALING_TAG_IDS = new Set(["bloodO", "bloodA", "bloodB", "bloodAB", "cold", "warm", "layered", "mixed", "liquid", "thick"]);
export function tagSupportsDegree(tagId) { return !NON_SCALING_TAG_IDS.has(tagId); }
export function formatTagLabel(tag) { return `${tag.label || TAG_DEFINITIONS[tag.id]?.label || tag.id}${tagSupportsDegree(tag.id) ? ` ${tag.degree || 1}` : ""}`; }
export const COCKTAIL_SLOT_CONFIG = [
  { id: "base-1", label: "Большой слот 1", accepts: ["plasma", "erythrocytes"] }, { id: "base-2", label: "Большой слот 2", accepts: ["plasma", "erythrocytes"] },
  { id: "film", label: "Слот плёнки", accepts: ["film"] }, { id: "additive-1", label: "Добавка 1", accepts: ["additive"] }, { id: "additive-2", label: "Добавка 2", accepts: ["additive"] },
];
const bloodGroups = [["o", "I (O)", "bloodO", "salty", null], ["a", "II (A)", "bloodA", "sweet", "invigorating"], ["b", "III (B)", "bloodB", "sour", "healing"], ["ab", "IV (AB)", "bloodAB", "bitter", "potential"]];
const makeIngredient = (id, name, type, tags) => ({ id, name, type, ...(type === "additive" ? { additiveCategory: "medical" } : {}), tags });
export const BAR_ADDITIVES = [
  ["additive-olive", "Оливка", "salty"],
  ["additive-lemon", "Лимон", "sour"],
  ["additive-grapefruit", "Грейпфрукт", "bitter"],
  ["additive-cherry", "Коктейльная вишня", "sweet"],
].map(([id, name, flavor]) => ({ id, name, type: "additive", additiveCategory: "bar", tags: [{ id: flavor, degree: 1 }] }));
const filmPairs = [
  ["bitter", "potential"], ["sour", "healing"], ["sweet", "healing"], ["salty", "invigorating"],
];
const filmFlavorIds = ["bitter", "sour", "sweet", "salty"];
const filmBenefitIds = ["invigorating", "healing", "potential", null];
export const LINKED_FILM_IDS = filmPairs.map(([flavor, benefit]) => `film-${flavor}-${benefit}`);
export const INGREDIENTS = [
  ...bloodGroups.map(([id, label, groupTag, flavor]) => makeIngredient(`plasma-${id}`, `Плазма ${label}`, "plasma", [{ id: groupTag, degree: 1 }, { id: flavor, degree: 1 }])),
  ...bloodGroups.map(([id, label, groupTag, _flavor, benefit]) => makeIngredient(`erythrocytes-${id}`, `Эритроциты ${label}`, "erythrocytes", [{ id: groupTag, degree: 1 }, ...(benefit ? [{ id: benefit, degree: 1 }] : [])])),
  ...filmFlavorIds.flatMap((flavor) => filmBenefitIds.map((benefit) => makeIngredient(`film-${flavor}-${benefit || "neutral"}`, `Плёнка: ${TAG_DEFINITIONS[flavor].label.toLowerCase()}${benefit ? " " + TAG_DEFINITIONS[benefit].label.toLowerCase() : ""}`, "film", [{ id: flavor, degree: 1 }, ...(benefit ? [{ id: benefit, degree: 1 }] : [])]))),
  makeIngredient("additive-syrup", "Сладкий сироп", "additive", [{ id: "sweet", degree: 1 }]),
  makeIngredient("additive-salt", "Соляной раствор", "additive", [{ id: "salty", degree: 1 }]),
  makeIngredient("additive-acid", "Кислая эссенция", "additive", [{ id: "sour", degree: 1 }]),
  makeIngredient("additive-bitters", "Горькие капли", "additive", [{ id: "bitter", degree: 1 }]),
  makeIngredient("additive-tonic", "Тоник", "additive", [{ id: "invigorating", degree: 1 }]),
  makeIngredient("additive-elixir", "Целебный эликсир", "additive", [{ id: "healing", degree: 1 }]),
  makeIngredient("additive-potential", "Экстракт потенциала", "additive", [{ id: "potential", degree: 1 }]),
  makeIngredient("additive-sour-sweet", "Кисло-сладкий концентрат", "additive", [{ id: "sour", degree: 1 }, { id: "sweet", degree: 1 }]),
  makeIngredient("additive-bitter-tonic", "Горький тоник", "additive", [{ id: "bitter", degree: 1 }, { id: "invigorating", degree: 1 }]),
  makeIngredient("additive-healing-salt", "Целебная соль", "additive", [{ id: "healing", degree: 1 }, { id: "salty", degree: 1 }]),
  ...BAR_ADDITIVES,
];
export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((entry) => [entry.id, entry]));

const COMPONENTS_STORAGE_KEY = "bloodbar-nighttime-components";
const COMPONENTS_STORAGE_VERSION = "2";
const COMPONENT_PROFILES_STORAGE_KEY = "bloodbar-nighttime-component-profiles";
const DEFAULT_COMPONENT_PROFILE = { id: "default", name: "Дефолт" };
let editableIngredients = null;
let componentProfiles = null;
let activeComponentProfileId = DEFAULT_COMPONENT_PROFILE.id;

function cloneIngredients(ingredients) {
  return ingredients.map((ingredient) => ({ ...ingredient, tags: ingredient.tags.map((tag) => ({ ...tag })) }));
}

function normalizeIngredients(value, migrateLegacy = false) {
  if (!Array.isArray(value)) return cloneIngredients(INGREDIENTS);
  const ingredients = value
    .filter((ingredient) => ingredient && typeof ingredient.id === "string" && typeof ingredient.name === "string" && ["plasma", "erythrocytes", "film", "additive"].includes(ingredient.type) && Array.isArray(ingredient.tags))
    .map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      type: ingredient.type,
      ...(ingredient.type === "additive" ? { additiveCategory: ingredient.additiveCategory === "bar" ? "bar" : "medical" } : {}),
      tags: ingredient.tags.filter((tag) => TAG_DEFINITIONS[tag?.id]).map((tag) => ({ id: tag.id, degree: Math.max(1, Math.min(3, Number(tag.degree) || 1)) })),
    }));
  // Old profiles had no subcategories. Preserve their contents and add the new bar catalog.
  if (migrateLegacy && value.length && !value.some((ingredient) => ingredient?.additiveCategory)) {
    const existingIds = new Set(ingredients.map((ingredient) => ingredient.id));
    ingredients.push(...cloneIngredients(BAR_ADDITIVES.filter((ingredient) => !existingIds.has(ingredient.id))));
  }
  return ingredients;
}

export function getIngredients() {
  if (editableIngredients) return editableIngredients;
  try {
    const profileStorageKey = `${COMPONENTS_STORAGE_KEY}:${getActiveComponentProfileId()}`;
    const profileValue = localStorage.getItem(profileStorageKey);
    const storageKey = profileValue ? profileStorageKey : getActiveComponentProfileId() === DEFAULT_COMPONENT_PROFILE.id ? COMPONENTS_STORAGE_KEY : profileStorageKey;
    const value = profileValue || localStorage.getItem(storageKey);
    editableIngredients = normalizeIngredients(JSON.parse(value || "null"), localStorage.getItem(`${storageKey}:version`) !== COMPONENTS_STORAGE_VERSION);
  } catch {
    editableIngredients = cloneIngredients(INGREDIENTS);
  }
  return editableIngredients;
}

export function setIngredients(ingredients) {
  editableIngredients = normalizeIngredients(ingredients);
  try {
    const storageKey = `${COMPONENTS_STORAGE_KEY}:${getActiveComponentProfileId()}`;
    localStorage.setItem(storageKey, JSON.stringify(editableIngredients));
    localStorage.setItem(`${storageKey}:version`, COMPONENTS_STORAGE_VERSION);
  } catch {
    // Редактор остаётся рабочим в памяти, если browser storage недоступен.
  }
  window.dispatchEvent(new Event("nighttime-components-changed"));
  return getIngredients();
}

export function getIngredientById(id) {
  return getIngredients().find((ingredient) => ingredient.id === id);
}

function persistComponentProfiles() {
  try {
    localStorage.setItem(COMPONENT_PROFILES_STORAGE_KEY, JSON.stringify({ profiles: componentProfiles, activeProfileId: activeComponentProfileId }));
  } catch {
    // Профили остаются доступными в памяти, если browser storage недоступен.
  }
}

function loadComponentProfiles() {
  if (componentProfiles) return;
  try {
    const saved = JSON.parse(localStorage.getItem(COMPONENT_PROFILES_STORAGE_KEY) || "null");
    const profiles = Array.isArray(saved?.profiles) ? saved.profiles.filter((profile) => typeof profile?.id === "string" && typeof profile?.name === "string") : [];
    componentProfiles = profiles.length ? profiles : [{ ...DEFAULT_COMPONENT_PROFILE }];
    activeComponentProfileId = componentProfiles.some((profile) => profile.id === saved?.activeProfileId) ? saved.activeProfileId : componentProfiles[0].id;
  } catch {
    componentProfiles = [{ ...DEFAULT_COMPONENT_PROFILE }];
  }
}

export function getComponentProfiles() {
  loadComponentProfiles();
  return componentProfiles.map((profile) => ({ ...profile }));
}

export function getActiveComponentProfileId() {
  loadComponentProfiles();
  return activeComponentProfileId;
}

export function setActiveComponentProfile(profileId) {
  loadComponentProfiles();
  if (!componentProfiles.some((profile) => profile.id === profileId)) return false;
  activeComponentProfileId = profileId;
  editableIngredients = null;
  persistComponentProfiles();
  window.dispatchEvent(new Event("nighttime-components-changed"));
  return true;
}

export function createComponentProfile(name) {
  loadComponentProfiles();
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return null;
  const profile = { id: `profile-${Date.now()}`, name: normalizedName };
  componentProfiles.push(profile);
  try {
    localStorage.setItem(`${COMPONENTS_STORAGE_KEY}:${profile.id}`, JSON.stringify(cloneIngredients(getIngredients())));
    localStorage.setItem(`${COMPONENTS_STORAGE_KEY}:${profile.id}:version`, COMPONENTS_STORAGE_VERSION);
  } catch {
    // Новый профиль получит текущие компоненты в памяти при следующем открытии.
  }
  activeComponentProfileId = profile.id;
  editableIngredients = null;
  persistComponentProfiles();
  window.dispatchEvent(new Event("nighttime-components-changed"));
  return { ...profile };
}

export function deleteComponentProfile(profileId) {
  loadComponentProfiles();
  if (componentProfiles.length <= 1) throw new Error("Нельзя удалить последний профиль.");
  const profile = componentProfiles.find((item) => item.id === profileId);
  if (!profile) return null;
  componentProfiles = componentProfiles.filter((item) => item.id !== profileId);
  if (activeComponentProfileId === profileId) activeComponentProfileId = componentProfiles[0].id;
  editableIngredients = null;
  try {
    localStorage.removeItem(`${COMPONENTS_STORAGE_KEY}:${profileId}`);
    localStorage.removeItem(`${COMPONENTS_STORAGE_KEY}:${profileId}:version`);
  } catch { /* storage is optional */ }
  persistComponentProfiles();
  window.dispatchEvent(new Event("nighttime-components-changed"));
  return { ...profile };
}

export function overwriteComponentProfile(profileId) {
  loadComponentProfiles();
  if (profileId === activeComponentProfileId) throw new Error("Нельзя перезаписать активный профиль самим собой.");
  const target = componentProfiles.find((profile) => profile.id === profileId);
  if (!target) throw new Error("Профиль для перезаписи не найден.");
  const ingredients = cloneIngredients(getIngredients());
  try {
    localStorage.setItem(`${COMPONENTS_STORAGE_KEY}:${profileId}`, JSON.stringify(ingredients));
    localStorage.setItem(`${COMPONENTS_STORAGE_KEY}:${profileId}:version`, COMPONENTS_STORAGE_VERSION);
  } catch { /* storage is optional */ }
  activeComponentProfileId = profileId;
  editableIngredients = ingredients;
  persistComponentProfiles();
  window.dispatchEvent(new Event("nighttime-components-changed"));
  return { ...target };
}
