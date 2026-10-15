import { traitCatalog } from "./data.js";
import { findTraitByRefInCatalog, normalizeText, normalizeTraitId, refsMatch, uniqueStrings } from "./trait-contract.js";

export { normalizeTraitEffects, normalizeTraitEntry, normalizeTraitId, serializeTrait, traitCategoryOptions } from "./trait-contract.js";

export function findTraitByRef(ref) {
  return findTraitByRefInCatalog(ref, traitCatalog);
}

export function normalizeTraitRef(ref) {
  return findTraitByRef(ref)?.id || "";
}

export function normalizeTraitRefs(refs) {
  return uniqueStrings(refs).map(normalizeTraitRef).filter(Boolean);
}

export function getTraitDisplayName(ref) {
  return findTraitByRef(ref)?.name || normalizeText(ref);
}

export function getTraitDescription(ref) {
  return findTraitByRef(ref)?.description || "Особенность агента.";
}

export function getTraitOptionEntries(selectedRefs = [], options = {}) {
  const includeDisabled = Boolean(options.includeDisabled);
  const selectedIds = new Set(uniqueStrings(selectedRefs).map(normalizeTraitId));
  return traitCatalog
    .filter((trait) => includeDisabled || !trait.disabled || selectedIds.has(trait.id))
    .map((trait) => ({
      value: trait.id,
      label: trait.name,
      description: trait.description,
      category: trait.category,
      disabled: Boolean(trait.disabled),
    }));
}

export function isTraitRefSelected(selectedRefs, traitRef) {
  const trait = findTraitByRef(traitRef);
  return (selectedRefs || []).some((selectedRef) => {
    if (!trait) return refsMatch(selectedRef, traitRef);
    return refsMatch(selectedRef, trait.id);
  });
}

export function addTraitRef(selectedRefs, traitRef) {
  if (isTraitRefSelected(selectedRefs, traitRef)) return [...(selectedRefs || [])];
  const trait = findTraitByRef(traitRef);
  if (!trait) return [...(selectedRefs || [])];
  return [...(selectedRefs || []), trait.id];
}

export function removeTraitRef(selectedRefs, traitRef) {
  const trait = findTraitByRef(traitRef);
  return (selectedRefs || []).filter((selectedRef) => {
    if (!trait) return !refsMatch(selectedRef, traitRef);
    return !refsMatch(selectedRef, trait.id);
  });
}

export function getDefaultSympathyTraitRef() {
  return traitCatalog.find((trait) => !trait.disabled && trait.tags?.includes("sympathy_trait"))?.id || traitCatalog.find((trait) => !trait.disabled)?.id || "";
}
