import { normalizeAdditiveEffects } from "./additive-effect-contract.js";

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
export function formatTagLabel(tag) { return `${tag.label || TAG_DEFINITIONS[tag.id]?.label || tag.id}${tagSupportsDegree(tag.id) ? ` ${tag.degree ?? 1}` : ""}`; }
export const COCKTAIL_SLOT_CONFIG = [
  { id: "base-1", label: "Большой слот 1", accepts: ["plasma", "erythrocytes"] }, { id: "base-2", label: "Большой слот 2", accepts: ["plasma", "erythrocytes"] },
  { id: "film", label: "Слот плёнки", accepts: ["film"] }, { id: "additive-1", label: "Добавка 1", accepts: ["additive"] }, { id: "additive-2", label: "Добавка 2", accepts: ["additive"] },
];
const bloodGroups = [["o", "I (O)", "bloodO", "salty", null], ["a", "II (A)", "bloodA", "sweet", "invigorating"], ["b", "III (B)", "bloodB", "sour", "healing"], ["ab", "IV (AB)", "bloodAB", "bitter", "potential"]];
const makeIngredient = (id, name, type, tags) => ({ id, name, type, description: "", effects: [], ...(type === "additive" ? { additiveCategory: "medical" } : {}), tags });
export const BAR_ADDITIVES = [
  ["additive-olive", "Оливка", "salty"],
  ["additive-lemon", "Лимон", "sour"],
  ["additive-grapefruit", "Грейпфрукт", "bitter"],
  ["additive-cherry", "Коктейльная вишня", "sweet"],
].map(([id, name, flavor]) => ({ id, name, type: "additive", additiveCategory: "bar", description: `${TAG_DEFINITIONS[flavor].label}: +1.`, effects: [], tags: [{ id: flavor, degree: 1 }] }));
const NEW_BAR_ADDITIVES = [
  ["mountain-salt", "Хлопья горной соли", "salty", "sweet"],
  ["lime", "Лайм", "sour", "salty"],
  ["ginger", "Имбирь", "bitter", "sour"],
  ["honey", "Мед", "sweet", "bitter"],
  ["celery", "Сельдерей", "salty", "sour"],
  ["pineapple", "Ананас", "sour", "bitter"],
  ["chocolate", "Шоколадная крошка", "bitter", "salty"],
  ["strawberry", "Клубника", "sweet", "sour"],
  ["pickles", "Соленья", "salty", "bitter"],
  ["passionfruit", "Маракуйа", "sour", "sweet"],
  ["rosemary", "Розмарин", "bitter", "sweet"],
  ["caramel", "Карамель", "sweet", "salty"],
].map(([id, name, positive, negative]) => ({
  id: `additive-${id}`, name, type: "additive", additiveCategory: "bar",
  description: `${TAG_DEFINITIONS[positive].label}: +1. ${TAG_DEFINITIONS[negative].label}: −1.`,
  tags: [{ id: positive, degree: 1 }, { id: negative, degree: -1 }], effects: [],
}));
const preferenceShift = (attitudes, amount) => ({ type: "preference_shift", attitudes, amount });
const conditionalPotential = (attitude, amount) => ({ type: "conditional_tag", attitude, tagId: "potential", amount });
const flavorContributions = (degree) => ["salty", "sweet", "sour", "bitter"].map((id) => [id, degree]);
const NEW_MEDICAL_ADDITIVES = [
  ["melatonin", "Мелатонин", "Целебное: +1. Бодрящее: −1.", [["healing", 1], ["invigorating", -1]], []],
  ["serotonin", "Серотонин", "Один случайный тег из столбцов отношений −2 и −1 сдвигается на −1. Только для текущего коктейля.", [], [preferenceShift([-2, -1], -1)]],
  ["dopamine", "Дофамин", "Бодрящее: +1. Горькое: +1.", [["invigorating", 1], ["bitter", 1]], []],
  ["noradrenaline", "Норадреналин", "Бодрящее: +1. Целебное: −1. Потенциал: −1.", [["invigorating", 1], ["healing", -1], ["potential", -1]], []],
  ["adrenaline", "Адреналин", "Бодрящее: +2. Целебное: −1. Один случайный тег из столбцов отношений +1 и +2 сдвигается на −1 для текущего коктейля.", [["invigorating", 2], ["healing", -1]], [preferenceShift([1, 2], -1)]],
  ["progress", "«Прогресс»", "Бодрящее: −1. Удваивает потенциал, а при его отсутствии добавляет потенциал 1.", [["invigorating", -1]], [{ type: "tag_multiply", tagId: "potential", factor: 2, fallback: 1 }]],
  ["splitter", "«Расщепитель»", "Нейтрализует группы крови и гемолиз в коктейле.", [], [{ type: "blood_neutralize" }]],
  ["ambrosia", "«Амброзия»", "Усиливает уже присутствующие в напитке теги из желаний +1 и +2: два разных случайных тега на +1, если подходят хотя бы два; единственный подходящий тег — дважды на +1. Не меняет желания, не выше желаемой степени. Выбор фиксируется для текущего клиента.", [], [{ type: "preferred_tag_boost", units: 2 }]],
  ["desalinator", "«Опреснитель»", "Солёное, сладкое, кислое и горькое: −1 каждое. Удовлетворение: −1.", flavorContributions(-1), [{ type: "satisfaction", amount: -1 }]],
  ["cortisol", "Кортизол", "Добавляет +1 к желаемому клиентом целебному свойству или потенциалу.", [], [{ type: "desired_tag", tagIds: ["healing", "potential"], amount: 1 }]],
  ["t3", "Трийодтиронин (Т3)", "Если в коктейле есть тег из “Совсем не хочет”, +1 Потенциал.", [], [conditionalPotential(-2, 1)]],
  ["oxytocin", "Окситоцин", "Бодрящее: −1. Удовлетворение: +1.", [["invigorating", -1]], [{ type: "satisfaction", amount: 1 }]],
  ["epo", "Эритропоэтин (EPO)", "Целебное: +2. Бодрящее: −1. Игнорирует предпочтения групп крови и делает коктейль густым.", [["healing", 2], ["invigorating", -1]], [{ type: "ignore_blood_preferences" }, { type: "force_thick" }]],
  ["rainbow", "«Радуга»", "Солёное, сладкое, кислое и горькое: +1 каждое. Удовлетворение: −1.", flavorContributions(1), [{ type: "satisfaction", amount: -1 }]],
  ["apotheosis", "«Апофеоз»", "Потенциал, целебное и бодрящее: +1 каждое.", [["potential", 1], ["healing", 1], ["invigorating", 1]], []],
  ["mediator", "«Медиатор»", "По одному тегу в каждом из двух средних столбцов отношений (+1 и −1) сдвигается на −1 для текущего коктейля.", [], [preferenceShift([1], -1), preferenceShift([-1], -1)]],
  ["placebo", "«Плацебо»", "Если в напитке есть тег из “Очень хочет”, +1 Потенциал. Если есть тег из “Совсем не хочет”, −1 Потенциал.", [], [conditionalPotential(2, 1), conditionalPotential(-2, -1)]],
  ["nectar", "«Нектар»", "Усиливает на +1 один случайный уже присутствующий в напитке тег из желаний +1 и +2. Не меняет желания, не выше желаемой степени. Выбор фиксируется для текущего клиента.", [], [{ type: "preferred_tag_boost", units: 1 }]],
].map(([id, name, description, tags, effects]) => ({
  id: `additive-${id}`, name, type: "additive", additiveCategory: "medical", description,
  tags: tags.map(([id, degree]) => ({ id, degree })), effects,
}));
// Version 2 already introduced the four original bar additives. Only these 30 are new in version 3.
const VERSION_3_ADDITIVES = [...NEW_BAR_ADDITIVES, ...NEW_MEDICAL_ADDITIVES];
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
  ...VERSION_3_ADDITIVES,
];
export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((entry) => [entry.id, entry]));

const COMPONENTS_STORAGE_KEY = "bloodbar-nighttime-components";
const COMPONENTS_STORAGE_VERSION = "4";
const COMPONENT_PROFILES_STORAGE_KEY = "bloodbar-nighttime-component-profiles";
const DEFAULT_COMPONENT_PROFILE = { id: "default", name: "Дефолт" };
let editableIngredients = null;
let componentProfiles = null;
let activeComponentProfileId = DEFAULT_COMPONENT_PROFILE.id;

function cloneIngredients(ingredients) {
  return ingredients.map((ingredient) => ({ ...ingredient, description: typeof ingredient.description === "string" ? ingredient.description : "", tags: ingredient.tags.map((tag) => ({ ...tag })), effects: normalizeAdditiveEffects(ingredient.effects) }));
}

function normalizeTagDegree(value, type) {
  const degree = Number(value);
  if (!Number.isFinite(degree) || !Number.isInteger(degree)) return 1;
  return type === "additive" ? degree : Math.max(1, degree);
}

function migratePreferredTagBoost(ingredient) {
  const units = ingredient.id === "additive-nectar" ? 1 : ingredient.id === "additive-ambrosia" ? 2 : null;
  if (!units || ingredient.type !== "additive" || !Array.isArray(ingredient.effects) || ingredient.effects.length !== 1) return ingredient;
  const effect = ingredient.effects[0];
  // Inspect the original data before normalization can discard invalid/custom effects.
  if (!effect || Object.keys(effect).length !== 3 || effect.type !== "preference_shift" || effect.amount !== units
    || !Array.isArray(effect.attitudes) || effect.attitudes.length !== 2 || effect.attitudes[0] !== 1 || effect.attitudes[1] !== 2) return ingredient;
  const oldDescription = `Один случайный тег из столбцов отношений +1 и +2 сдвигается на +${units} для текущего коктейля.`;
  const description = typeof ingredient.description === "string" ? ingredient.description : "";
  return { ...ingredient, effects: [{ type: "preferred_tag_boost", units }],
    description: !description.trim() || description === oldDescription ? INGREDIENT_BY_ID[ingredient.id].description : description };
}

function normalizeIngredients(value, storageVersion = COMPONENTS_STORAGE_VERSION) {
  if (!Array.isArray(value)) return cloneIngredients(INGREDIENTS);
  const ingredients = value
    .filter((ingredient) => ingredient && typeof ingredient.id === "string" && typeof ingredient.name === "string" && ["plasma", "erythrocytes", "film", "additive"].includes(ingredient.type) && Array.isArray(ingredient.tags))
    .map((ingredient) => storageVersion === COMPONENTS_STORAGE_VERSION ? ingredient : migratePreferredTagBoost(ingredient))
    .map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      type: ingredient.type,
      description: typeof ingredient.description === "string" ? ingredient.description : "",
      effects: normalizeAdditiveEffects(ingredient.effects),
      ...(ingredient.type === "additive" ? { additiveCategory: ingredient.additiveCategory === "bar" ? "bar" : "medical" } : {}),
      tags: ingredient.tags.filter((tag) => TAG_DEFINITIONS[tag?.id]).map((tag) => ({ id: tag.id, degree: normalizeTagDegree(tag.degree, ingredient.type) })),
    }));
  // Retain the original pre-v2 migration, but never resurrect deleted v2 bar additives.
  const migrateV3 = storageVersion !== "3" && storageVersion !== COMPONENTS_STORAGE_VERSION;
  if (migrateV3 && storageVersion !== "2" && value.length && !value.some((ingredient) => ingredient?.additiveCategory)) {
    const existingIds = new Set(ingredients.map((ingredient) => ingredient.id));
    ingredients.push(...cloneIngredients(BAR_ADDITIVES.filter((ingredient) => !existingIds.has(ingredient.id))));
  }
  if (migrateV3) {
    const existingIds = new Set(ingredients.map((ingredient) => ingredient.id));
    ingredients.push(...cloneIngredients(VERSION_3_ADDITIVES.filter((ingredient) => !existingIds.has(ingredient.id))));
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
    editableIngredients = normalizeIngredients(JSON.parse(value || "null"), localStorage.getItem(`${storageKey}:version`));
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
