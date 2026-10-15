import { deepClone } from "./utils.js";
import { normalizeTraitEffectList } from "./trait-effect-registry.js";

const DEFAULT_TRAIT_CATEGORY = "custom";

export const TRAIT_FIELD_KEYS = ["id", "name", "description", "category", "tags", "effects", "disabled"];

export const traitCategoryOptions = [
  { value: "stat", label: "Стат" },
  { value: "energy", label: "Энергия" },
  { value: "fatigue", label: "Усталость" },
  { value: "sympathy", label: "Симпатия" },
  { value: "movement", label: "Перемещение" },
  { value: "roll", label: "Броски" },
  { value: "resource", label: "Ресурсы" },
  { value: "upkeep", label: "Содержание" },
  { value: "roleplay", label: "Роль" },
  { value: "custom", label: "Другое" },
];

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeTraitId(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueStrings(values) {
  return [...new Set((values || []).map(normalizeText).filter(Boolean))];
}

export function normalizeTraitEffects(value, context = {}) {
  return normalizeTraitEffectList(value, context).map((effect) => deepClone(effect));
}

export function normalizeTraitEntry(trait, fallbackId = "trait", context = {}) {
  const id = normalizeTraitId(trait?.id) || fallbackId;
  const name = normalizeText(trait?.name) || id;
  const category = normalizeText(trait?.category) || DEFAULT_TRAIT_CATEGORY;
  return {
    id,
    name,
    description: normalizeText(trait?.description),
    category,
    tags: uniqueStrings(Array.isArray(trait?.tags) ? trait.tags : String(trait?.tags || "").split(",")),
    effects: normalizeTraitEffects(trait?.effects, context),
    disabled: Boolean(trait?.disabled),
  };
}

export function normalizeTraitCatalog(savedTraits, context = {}) {
  const seenTraitIds = new Set();
  return (savedTraits || [])
    .map((trait, index) => normalizeTraitEntry(trait, `trait-${index + 1}`, context))
    .filter((trait) => {
      if (!trait.id || seenTraitIds.has(trait.id)) return false;
      seenTraitIds.add(trait.id);
      return true;
    });
}

export function serializeTrait(trait, context = {}) {
  return normalizeTraitEntry(trait, trait?.id || "trait", context);
}

export function refsMatch(left, right) {
  return normalizeTraitId(left) === normalizeTraitId(right);
}

export function findTraitByRefInCatalog(ref, traitCatalog) {
  const id = normalizeTraitId(ref);
  if (!id) return null;
  return traitCatalog.find((trait) => normalizeTraitId(trait.id) === id) || null;
}

export function normalizeTraitRefFromCatalog(ref, traitCatalog) {
  return findTraitByRefInCatalog(ref, traitCatalog)?.id || "";
}

export function normalizeTraitRefsFromCatalog(refs, traitCatalog) {
  return uniqueStrings(refs).map((ref) => normalizeTraitRefFromCatalog(ref, traitCatalog)).filter(Boolean);
}
