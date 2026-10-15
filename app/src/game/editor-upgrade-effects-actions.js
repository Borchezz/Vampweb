import { editorState } from "./state.js";
import { paths, upgrades } from "./data.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";
import { createEffectListEditorActions } from "./editor-effect-controls.js";
import {
  createDefaultUpgradeEffect,
  getUpgradeEffectFieldDefinition,
  normalizeUpgradeEffectFieldValue,
  UPGRADE_EFFECT_TYPES,
} from "./upgrade-effect-registry.js";

function getUpgradeForEffectAction(upgradeId) {
  return upgrades.find((item) => item.id === upgradeId);
}

function createUpgradeEffect({ type = "", context = {} } = {}) {
  return createDefaultUpgradeEffect(type || UPGRADE_EFFECT_TYPES[0], context);
}

function finishUpgradeEffectEdit(upgrade) {
  editorState.upgradeId = upgrade.id;
  recordEditorChange("upgrade", upgrade.id, "buyEffects");
  saveEditorDraft(true);
  render();
}

const upgradeEffectActions = createEffectListEditorActions({
  dataset: {
    add: "upgradeEffectAdd",
    remove: "upgradeEffectRemove",
    owner: "upgradeEffectUpgrade",
    field: "upgradeEffectField",
    index: "upgradeEffectIndex",
    listKey: "",
  },
  getOwner: getUpgradeForEffectAction,
  getListField: () => "buyEffects",
  getContext: () => ({ paths }),
  createEffect: createUpgradeEffect,
  getFieldDefinition: getUpgradeEffectFieldDefinition,
  normalizeFieldValue: normalizeUpgradeEffectFieldValue,
  finishEdit: finishUpgradeEffectEdit,
});

export const handleAddUpgradeEffect = upgradeEffectActions.handleAddEffect;
export const handleRemoveUpgradeEffect = upgradeEffectActions.handleRemoveEffect;
export const handleUpgradeEffectFieldChange = upgradeEffectActions.handleEffectFieldChange;
