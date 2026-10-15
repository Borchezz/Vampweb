import { tasks } from "./data.js";
import {
  LOCATION_VISIBILITY_ACTION_OPTIONS,
  LOCATION_VISIBILITY_TRIGGER_OPTIONS,
  normalizeLocationVisibilityConditions,
} from "./location-contract.js";
import { WEEKDAY_NAMES } from "./state.js";
import { escapeAttribute, escapeHtml } from "./rules.js";

function renderOptions(entries, value) {
  return entries.map((entry) => `<option value="${escapeAttribute(entry.value)}" ${String(entry.value) === String(value) ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("");
}

function renderConditionTarget(condition, attrs) {
  if (condition.trigger === "day_number") {
    return `<label class="editor-field location-visibility-condition-target"><span>Номер дня</span><input type="number" min="1" value="${condition.day}" data-location-visibility-field="day" ${attrs}></label>`;
  }
  if (condition.trigger === "weekday") {
    return `<label class="editor-field location-visibility-condition-target"><span>День недели</span><select data-location-visibility-field="weekday" ${attrs}>${renderOptions(WEEKDAY_NAMES.map((label, value) => ({ value, label })), condition.weekday)}</select></label>`;
  }
  if (condition.trigger === "task_complete") {
    return `<label class="editor-field wide location-visibility-condition-target"><span>Задача</span><select data-location-visibility-field="taskId" ${attrs}>${renderOptions(tasks.map((task) => ({ value: task.id, label: task.name })), condition.taskId)}</select></label>`;
  }
  return "";
}

export function renderLocationVisibilityEditor(location) {
  const conditions = normalizeLocationVisibilityConditions(location.visibilityConditions);
  return `<section class="editor-section location-visibility-editor">
    <div class="editor-section-header"><h3>Видимость локации</h3><button class="secondary-button compact-button" type="button" data-location-visibility-add="${escapeAttribute(location.id)}">Добавить условие</button></div>
    <p class="editor-note">Условия применяются по порядку: каждое может скрыть или показать локацию.</p>
    <div class="location-visibility-condition-list">
      ${conditions.map((condition) => {
        const attrs = `data-location-visibility-location="${escapeAttribute(location.id)}" data-location-visibility-id="${escapeAttribute(condition.id)}"`;
        return `<div class="location-visibility-condition">
          <div class="editor-grid location-visibility-condition-fields">
            <label class="editor-field"><span>Условие</span><select data-location-visibility-field="trigger" ${attrs}>${renderOptions(LOCATION_VISIBILITY_TRIGGER_OPTIONS, condition.trigger)}</select></label>
            <label class="editor-field"><span>Действие</span><select data-location-visibility-field="action" ${attrs}>${renderOptions(LOCATION_VISIBILITY_ACTION_OPTIONS, condition.action)}</select></label>
            <button class="secondary-button compact-button location-visibility-condition-remove" type="button" data-location-visibility-remove ${attrs}>Удалить</button>
            ${renderConditionTarget(condition, attrs)}
          </div>
        </div>`;
      }).join("") || '<p class="editor-note">Условий нет. Локация использует значение по умолчанию.</p>'}
    </div>
  </section>`;
}
