import { resourceDefs } from "./state.js";
import { locations, zones } from "./data.js";
import { escapeAttribute, escapeHtml } from "./rules.js";

export function renderEntityPicker(kind, items, selectedId, label = "Сущность") {
  return `
    <label class="editor-field wide entity-picker" data-editor-object-picker="${escapeAttribute(kind)}">
      <span>${label}</span>
      <select data-editor-picker="${kind}">
        ${items
          .map(
            (item) => `<option value="${escapeAttribute(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

export function renderTextField(scope, id, field, label, value, options = {}) {
  const type = options.type || "text";
  const wide = options.wide ? " wide" : "";
  const attributes = [
    options.min !== undefined ? `min="${escapeAttribute(options.min)}"` : "",
    options.max !== undefined ? `max="${escapeAttribute(options.max)}"` : "",
    options.step !== undefined ? `step="${escapeAttribute(options.step)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <label class="editor-field${wide}">
      <span>${label}</span>
      <input type="${type}" value="${escapeAttribute(value ?? "")}" ${attributes} data-edit-scope="${scope}" data-edit-id="${id}" data-edit-field="${field}">
    </label>
  `;
}

export function renderTextareaField(scope, id, field, label, value) {
  return `
    <label class="editor-field wide">
      <span>${label}</span>
      <textarea data-edit-scope="${scope}" data-edit-id="${id}" data-edit-field="${field}">${escapeHtml(value ?? "")}</textarea>
    </label>
  `;
}

export function renderSelectField(scope, id, field, label, value, options) {
  const disabled = options?.disabled ? "disabled" : "";
  const entries = Array.isArray(options) ? options : options?.entries || [];
  return `
    <label class="editor-field">
      <span>${label}</span>
      <select ${disabled} data-edit-scope="${scope}" data-edit-id="${id}" data-edit-field="${field}">
        ${entries
          .map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;
            return `<option value="${escapeAttribute(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
          })
          .join("")}
      </select>
    </label>
  `;
}

export function renderCheckboxField(scope, id, field, label, value) {
  return `
    <label class="editor-field">
      <span>${label}</span>
      <input type="checkbox" ${value ? "checked" : ""} data-edit-scope="${scope}" data-edit-id="${id}" data-edit-field="${field}">
    </label>
  `;
}

export function renderResourceFields() {
  return Object.entries(resourceDefs)
    .map(([key, resource]) => ({ key, label: resource.label }))
    .map(({ key, label }) => ({ key, label }));
}

export function zoneOptions() {
  return zones.map((zone) => ({ value: zone.id, label: zone.name }));
}

export function locationOptions() {
  return locations.map((location) => ({ value: location.id, label: location.name }));
}
