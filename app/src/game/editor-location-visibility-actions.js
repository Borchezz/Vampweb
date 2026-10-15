import { locations } from "./data.js";
import { normalizeLocationVisibilityConditions } from "./location-contract.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { render } from "./render-core.js";

function updateVisibility(locationId, update) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;
  const conditions = normalizeLocationVisibilityConditions(location.visibilityConditions);
  update(conditions, location);
  location.visibilityConditions = conditions;
  recordEditorChange("location", locationId, "visibilityConditions");
  saveEditorDraft(true);
  render();
}

function createCondition(conditions) {
  let index = conditions.length + 1;
  while (conditions.some((condition) => condition.id === `visibility-${index}`)) index += 1;
  return { id: `visibility-${index}`, trigger: "game_start", action: "hide", day: 1, weekday: 0, taskId: "" };
}

export function handleLocationVisibilityAdd(button) {
  updateVisibility(button.dataset.locationVisibilityAdd, (conditions) => conditions.push(createCondition(conditions)));
}

export function handleLocationVisibilityRemove(button) {
  updateVisibility(button.dataset.locationVisibilityLocation, (conditions) => {
    const index = conditions.findIndex((condition) => condition.id === button.dataset.locationVisibilityId);
    if (index >= 0) conditions.splice(index, 1);
  });
}

export function handleLocationVisibilityFieldChange(input) {
  updateVisibility(input.dataset.locationVisibilityLocation, (conditions) => {
    const condition = conditions.find((item) => item.id === input.dataset.locationVisibilityId);
    if (!condition) return;
    const field = input.dataset.locationVisibilityField;
    if (field === "day") condition.day = Math.max(1, Math.trunc(Number(input.value) || 1));
    else if (field === "weekday") condition.weekday = Math.max(0, Math.min(6, Math.trunc(Number(input.value) || 0)));
    else condition[field] = input.value;
  });
}
