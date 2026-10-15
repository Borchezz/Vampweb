import { renderEffectListEditor } from "./editor-effect-controls.js";
import {
  EVENT_EFFECT_DEFINITIONS,
  getEventEffectDescription,
  getEventEffectFieldDefinitions,
} from "./event-effect-registry.js";

function getEventEffectDataset({ eventId, field = "", index = "" }) {
  const dataset = {
    "data-event-effect-event": eventId,
    "data-event-effect-index": index,
  };
  if (field) dataset["data-event-effect-field"] = field;
  return dataset;
}

export function renderEventEffectsEditor(event) {
  return renderEffectListEditor({
    ownerId: event.id,
    effects: Array.isArray(event.effects) ? event.effects : [],
    title: "Эффекты",
    emptyText: "Эффекты события не заданы.",
    definitions: EVENT_EFFECT_DEFINITIONS,
    getFieldDefinitions: getEventEffectFieldDefinitions,
    getDescription: getEventEffectDescription,
    getTypeDataset: ({ ownerId, index }) => getEventEffectDataset({ eventId: ownerId, field: "type", index }),
    getFieldDataset: ({ ownerId, index, field }) => getEventEffectDataset({ eventId: ownerId, field: field.key, index }),
    getAddDataset: ({ ownerId }) => ({ "data-event-effect-add": ownerId }),
    getRemoveDataset: ({ ownerId, index }) => ({
      "data-event-effect-remove": ownerId,
      "data-event-effect-index": index,
    }),
    getRowDataset: () => ({ "data-event-effect-row": true }),
  });
}
