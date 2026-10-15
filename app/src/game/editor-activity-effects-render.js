import { renderEffectListEditor } from "./editor-effect-controls.js";
import {
  ACTIVITY_EFFECT_DEFINITIONS,
  getActivityEffectDescription,
  getActivityEffectFieldDefinitions,
} from "./activity-effect-registry.js";

function getActivityEffectDataset({ activityId, field = "", index = "" }) {
  const dataset = {
    "data-activity-effect-activity": activityId,
    "data-activity-effect-index": index,
  };
  if (field) dataset["data-activity-effect-field"] = field;
  return dataset;
}

export function renderActivityEffectsEditor(activity) {
  return renderEffectListEditor({
    ownerId: activity.id,
    effects: Array.isArray(activity.effects) ? activity.effects : [],
    title: "Эффекты",
    emptyText: "Эффекты активности не заданы.",
    definitions: ACTIVITY_EFFECT_DEFINITIONS,
    getFieldDefinitions: getActivityEffectFieldDefinitions,
    getDescription: getActivityEffectDescription,
    getTypeDataset: ({ ownerId, index }) => getActivityEffectDataset({ activityId: ownerId, field: "type", index }),
    getFieldDataset: ({ ownerId, index, field }) => getActivityEffectDataset({ activityId: ownerId, field: field.key, index }),
    getAddDataset: ({ ownerId }) => ({ "data-activity-effect-add": ownerId }),
    getRemoveDataset: ({ ownerId, index }) => ({ "data-activity-effect-remove": ownerId, "data-activity-effect-index": index }),
    getRowDataset: () => ({ "data-activity-effect-row": true }),
  });
}
