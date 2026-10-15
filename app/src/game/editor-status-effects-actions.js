import { statusEffects } from "./data.js";
import { editorState } from "./state.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import { createEffectListEditorActions } from "./editor-effect-controls.js";
import { STATUS_EFFECT_TYPES, createDefaultStatusEffect, getStatusEffectFieldDefinition, normalizeStatusEffectFieldValue } from "./status-effect-registry.js";

const actions = createEffectListEditorActions({
  dataset: { add: "statusEffectAdd", remove: "statusEffectRemove", owner: "statusEffectStatus", field: "statusEffectField", index: "statusEffectIndex", listKey: "" },
  getOwner: (id) => statusEffects.find((status) => status.id === id), getListField: () => "effects", getContext: () => ({}),
  createEffect: ({ type }) => createDefaultStatusEffect(type || STATUS_EFFECT_TYPES[0]), getFieldDefinition: getStatusEffectFieldDefinition,
  normalizeFieldValue: normalizeStatusEffectFieldValue,
  finishEdit: (status) => { editorState.statusId = status.id; recordEditorChange("status", status.id, "effects"); saveEditorDraft(true); render(); },
});

export const handleAddStatusEffect = actions.handleAddEffect;
export const handleRemoveStatusEffect = actions.handleRemoveEffect;
export const handleStatusEffectFieldChange = actions.handleEffectFieldChange;
