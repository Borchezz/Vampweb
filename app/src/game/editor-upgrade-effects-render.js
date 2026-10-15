import { renderEffectListEditor } from "./editor-effect-controls.js";
import {
  getUpgradeEffectDescription,
  getUpgradeEffectFieldDefinitions,
  UPGRADE_EFFECT_DEFINITIONS,
} from "./upgrade-effect-registry.js";

function getUpgradeEffectDataset({ upgradeId, field = "", index = "" }) {
  const dataset = {
    "data-upgrade-effect-upgrade": upgradeId,
    "data-upgrade-effect-index": index,
  };
  if (field) dataset["data-upgrade-effect-field"] = field;
  return dataset;
}

export function renderUpgradeEffectsEditor(upgrade) {
  return renderEffectListEditor({
    ownerId: upgrade.id,
    effects: Array.isArray(upgrade.buyEffects) ? upgrade.buyEffects : [],
    title: "Эффекты покупки",
    emptyText: "Эффекты покупки не заданы.",
    definitions: UPGRADE_EFFECT_DEFINITIONS,
    getFieldDefinitions: getUpgradeEffectFieldDefinitions,
    getDescription: getUpgradeEffectDescription,
    getTypeDataset: ({ ownerId, index }) => getUpgradeEffectDataset({ upgradeId: ownerId, field: "type", index }),
    getFieldDataset: ({ ownerId, index, field }) => getUpgradeEffectDataset({ upgradeId: ownerId, field: field.key, index }),
    getAddDataset: ({ ownerId }) => ({ "data-upgrade-effect-add": ownerId }),
    getRemoveDataset: ({ ownerId, index }) => ({
      "data-upgrade-effect-remove": ownerId,
      "data-upgrade-effect-index": index,
    }),
    getRowDataset: () => ({ "data-upgrade-effect-row": true }),
  });
}
