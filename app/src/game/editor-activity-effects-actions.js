import { activities, statusEffects } from "./data.js";
import { editorState, resourceDefs } from "./state.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import { createEffectListEditorActions } from "./editor-effect-controls.js";
import {
  ACTIVITY_EFFECT_TYPES,
  createDefaultActivityEffect,
  getActivityEffectFieldDefinition,
  normalizeActivityEffectFieldValue,
} from "./activity-effect-registry.js";

const activityEffectActions = createEffectListEditorActions({
  dataset: { add: "activityEffectAdd", remove: "activityEffectRemove", owner: "activityEffectActivity", field: "activityEffectField", index: "activityEffectIndex", listKey: "" },
  getOwner: (activityId) => activities.find((item) => item.id === activityId),
  getListField: () => "effects",
  getContext: () => ({ resources: resourceDefs, resourceDefs, statusEffects }),
  createEffect: ({ type, context }) => createDefaultActivityEffect(type || ACTIVITY_EFFECT_TYPES[0], context),
  getFieldDefinition: getActivityEffectFieldDefinition,
  normalizeFieldValue: normalizeActivityEffectFieldValue,
  finishEdit: (activity) => {
    editorState.activityId = activity.id;
    recordEditorChange("activity", activity.id, "effects");
    saveEditorDraft(true);
    render();
  },
});

export const handleAddActivityEffect = activityEffectActions.handleAddEffect;
export const handleRemoveActivityEffect = activityEffectActions.handleRemoveEffect;
export const handleActivityEffectFieldChange = activityEffectActions.handleEffectFieldChange;
