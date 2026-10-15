import { renderEffectListEditor } from "./editor-effect-controls.js";
import { STATUS_EFFECT_DEFINITIONS, getStatusEffectDescription, getStatusEffectFieldDefinitions } from "./status-effect-registry.js";

export function renderStatusEffectsEditor(status) {
  const dataset = (id, index, field = "") => {
    const value = { "data-status-effect-status": id, "data-status-effect-index": index };
    if (field) value["data-status-effect-field"] = field;
    return value;
  };
  return renderEffectListEditor({
    ownerId: status.id, effects: status.effects || [], title: "Эффекты", emptyText: "Эффекты статуса не заданы.",
    definitions: STATUS_EFFECT_DEFINITIONS, getFieldDefinitions: getStatusEffectFieldDefinitions, getDescription: getStatusEffectDescription,
    getTypeDataset: ({ ownerId, index }) => dataset(ownerId, index, "type"),
    getFieldDataset: ({ ownerId, index, field }) => dataset(ownerId, index, field.key),
    getAddDataset: ({ ownerId }) => ({ "data-status-effect-add": ownerId }),
    getRemoveDataset: ({ ownerId, index }) => ({ "data-status-effect-remove": ownerId, "data-status-effect-index": index }),
  });
}
