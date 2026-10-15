import { editorState, resourceDefs } from "./state.js";
import { eventDeck, paths, statusEffects } from "./data.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import { createEffectListEditorActions } from "./editor-effect-controls.js";
import {
  createDefaultEventEffect,
  EVENT_EFFECT_TYPES,
  getEventEffectFieldDefinition,
  normalizeEventEffectFieldValue,
} from "./event-effect-registry.js";

function getEventForEffectAction(eventId) {
  return eventDeck.find((item) => item.id === eventId);
}

function createEventEffect({ type = "", context = {} } = {}) {
  return createDefaultEventEffect(type || EVENT_EFFECT_TYPES[0], context);
}

function finishEventEffectEdit(event) {
  editorState.eventId = event.id;
  recordEditorChange("event", event.id, "effects");
  saveEditorDraft(true);
  render();
}

const eventEffectActions = createEffectListEditorActions({
  dataset: {
    add: "eventEffectAdd",
    remove: "eventEffectRemove",
    owner: "eventEffectEvent",
    field: "eventEffectField",
    index: "eventEffectIndex",
    listKey: "",
  },
  getOwner: getEventForEffectAction,
  getListField: () => "effects",
  getContext: () => ({ resources: resourceDefs, resourceDefs, statusEffects, paths }),
  createEffect: createEventEffect,
  getFieldDefinition: getEventEffectFieldDefinition,
  normalizeFieldValue: normalizeEventEffectFieldValue,
  finishEdit: finishEventEffectEdit,
});

export const handleAddEventEffect = eventEffectActions.handleAddEffect;
export const handleRemoveEventEffect = eventEffectActions.handleRemoveEffect;
export const handleEventEffectFieldChange = eventEffectActions.handleEffectFieldChange;
