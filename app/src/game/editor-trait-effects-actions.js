import { editorState, resourceDefs, statDefs } from "./state.js";
import { paths, statusEffects, traitCatalog } from "./data.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import {
  createDefaultTraitEffect,
  getTraitEffectFieldDefinition,
  normalizeTraitEffectFieldValue as normalizeTraitEffectRegistryFieldValue,
  TRAIT_EFFECT_TYPES,
} from "./trait-effect-registry.js";

function createTraitEffect(type = TRAIT_EFFECT_TYPES[0]) {
  return createDefaultTraitEffect(type, { resourceDefs, statDefs, statusEffects, paths });
}

function clampTraitStatusStacks(effect) {
  if (effect?.type !== "grant_status") return;
  const maxStacks = statusEffects.find((status) => status.id === effect.statusId)?.maxStacks;
  if (!maxStacks) return;
  effect.stacks = Math.min(maxStacks, Math.max(1, Math.trunc(Number(effect.stacks) || 1)));
}

function getTraitForEffectAction(traitId) {
  return traitCatalog.find((item) => item.id === traitId);
}

function finishTraitEffectEdit(trait, changeLabel = "effects") {
  editorState.traitId = trait.id;
  recordEditorChange("trait", trait.id, changeLabel);
  saveEditorDraft(true);
  render();
}

export function handleAddTraitEffect(button) {
  const trait = getTraitForEffectAction(button.dataset.traitEffectAdd);
  if (!trait) return;
  trait.effects = Array.isArray(trait.effects) ? trait.effects : [];
  trait.effects.push(createTraitEffect());
  finishTraitEffectEdit(trait);
}

export function handleRemoveTraitEffect(button) {
  const trait = getTraitForEffectAction(button.dataset.traitEffectRemove);
  const index = Number(button.dataset.traitEffectIndex);
  if (!trait || !Number.isInteger(index) || !Array.isArray(trait.effects) || !trait.effects[index]) return;
  trait.effects.splice(index, 1);
  finishTraitEffectEdit(trait);
}

export function handleTraitEffectFieldChange(input) {
  const trait = getTraitForEffectAction(input.dataset.traitEffectTrait);
  const index = Number(input.dataset.traitEffectIndex);
  const field = input.dataset.traitEffectField;
  if (!trait || !Number.isInteger(index) || !field) return;
  trait.effects = Array.isArray(trait.effects) ? trait.effects : [];
  if (!trait.effects[index]) trait.effects[index] = createTraitEffect();

  if (field === "type") {
    trait.effects[index] = createTraitEffect(input.value);
    finishTraitEffectEdit(trait);
    return;
  }

  const effect = trait.effects[index];
  const fieldDefinition = getTraitEffectFieldDefinition(effect.type, field);
  if (!fieldDefinition) return;
  effect[field] = normalizeTraitEffectRegistryFieldValue(fieldDefinition, input.value, { resourceDefs, statDefs, statusEffects, paths });
  clampTraitStatusStacks(effect);
  finishTraitEffectEdit(trait);
}
