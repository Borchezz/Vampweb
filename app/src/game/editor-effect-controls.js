import { resourceDefs, statDefs } from "./state.js";
import { paths, statusEffects, tasks, upgrades } from "./data.js";
import { escapeAttribute, escapeHtml } from "./rules.js";

const ROUNDING_OPTIONS = [
  { value: "ceil", label: "Вверх" },
  { value: "floor", label: "Вниз" },
  { value: "round", label: "Математически" },
];

function renderSelectOptions(options, selectedValue) {
  return options
    .map((option) => {
      const value = typeof option === "string" ? option : option.value;
      const label = typeof option === "string" ? option : option.label;
      const selected = value === selectedValue ? "selected" : "";
      return `<option value="${escapeAttribute(value)}" ${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function getResourceOptions() {
  return Object.entries(resourceDefs).map(([value, def]) => ({ value, label: def.label }));
}

function getStatOptions() {
  return Object.entries(statDefs)
    .filter(([value]) => value !== "none")
    .map(([value, def]) => ({ value, label: def.full || def.label }));
}

function getTaskOptions() {
  return tasks.map((task) => ({ value: task.id, label: task.name || task.id }));
}

function getUpgradeOptions(includeEmpty = true) {
  const upgradeOptions = upgrades.map((upgrade) => ({ value: upgrade.id, label: upgrade.name || upgrade.id }));
  return includeEmpty ? [{ value: "", label: "Нет" }, ...upgradeOptions] : upgradeOptions;
}

function getStatusOptions() {
  return statusEffects.map((status) => ({ value: status.id, label: status.name || status.id }));
}

function getPathOptions() {
  return paths.map((path) => ({ value: path.id, label: path.name || path.id }));
}

function getStatusDetails(statusId) {
  return statusEffects.find((status) => status.id === statusId) || null;
}

function clampGrantStatusStacks(effect) {
  if (effect?.type !== "grant_status") return;
  const maxStacks = getStatusDetails(effect.statusId)?.maxStacks;
  if (!maxStacks) return;
  effect.stacks = Math.min(maxStacks, Math.max(1, Math.trunc(Number(effect.stacks) || 1)));
}

function renderEffectFieldOptions(fieldDefinition, value) {
  if (Array.isArray(fieldDefinition.options)) return renderSelectOptions(fieldDefinition.options, value);
  if (fieldDefinition.input === "resource") return renderSelectOptions(getResourceOptions(), value);
  if (fieldDefinition.input === "stat") return renderSelectOptions(getStatOptions(), value);
  if (fieldDefinition.input === "task") return renderSelectOptions(getTaskOptions(), value);
  if (fieldDefinition.input === "upgrade") return renderSelectOptions(getUpgradeOptions(true), value);
  if (fieldDefinition.input === "status") return renderSelectOptions(getStatusOptions(), value);
  if (fieldDefinition.input === "path") return renderSelectOptions(getPathOptions(), value);
  if (fieldDefinition.input === "rounding") return renderSelectOptions(ROUNDING_OPTIONS, value);
  return "";
}

function renderDatasetAttributes(dataset = {}) {
  return Object.entries(dataset)
    .map(([name, value]) => (value === true || value === "" ? name : `${name}="${escapeAttribute(value)}"`))
    .join(" ");
}

function getResourceMapInputDataset(dataset, resource) {
  return {
    ...dataset,
    "data-effect-resource-map-key": resource,
  };
}

function renderEffectTypeOptions({ definitions, selectedType }) {
  return definitions
    .map((definition) => {
      const selected = definition.type === selectedType ? "selected" : "";
      return `<option value="${escapeAttribute(definition.type)}" ${selected}>${escapeHtml(definition.label || definition.type)}</option>`;
    })
    .join("");
}

function renderEffectField({ effect, fieldDefinition, dataset, className = "" }) {
  const field = fieldDefinition.key;
  const value = effect[field] ?? "";
  const label = fieldDefinition.label || field;
  const datasetAttributes = renderDatasetAttributes(dataset);
  const fieldClassName = `editor-field trait-effect-field ${className}`.trim();

  if (Array.isArray(fieldDefinition.options) || ["resource", "stat", "task", "upgrade", "status", "path", "rounding"].includes(fieldDefinition.input)) {
    const status = fieldDefinition.input === "status" ? getStatusDetails(value) : null;
    return `
      <label class="${fieldClassName}">
        <span>${escapeHtml(label)}</span>
        <select ${datasetAttributes}>${renderEffectFieldOptions(fieldDefinition, value)}</select>
        ${status ? `<small class="status-effect-details">${escapeHtml(status.description)} · ${status.duration} дн. · до ${status.maxStacks} стаков</small>` : ""}
      </label>
    `;
  }

  if (fieldDefinition.input === "boolean") {
    return `
      <label class="${fieldClassName} checkbox-field">
        <span>${escapeHtml(label)}</span>
        <input type="checkbox" ${value ? "checked" : ""} ${datasetAttributes}>
      </label>
    `;
  }

  if (fieldDefinition.input === "resourceMap") {
    const resourceMap = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return `
      <div class="${fieldClassName} wide trait-effect-resource-map">
        <span>${escapeHtml(label)}</span>
        <div class="trait-effect-resource-grid">
          ${Object.entries(resourceDefs)
            .map(([resource, def]) => {
              const inputDataset = renderDatasetAttributes(getResourceMapInputDataset(dataset, resource));
              return `
                <label class="trait-effect-resource-field">
                  <span>${escapeHtml(def.short || def.label || resource)}</span>
                  <input type="number" value="${escapeAttribute(resourceMap[resource] ?? 0)}" step="1" ${inputDataset}>
                </label>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  const min = fieldDefinition.min !== undefined ? `min="${escapeAttribute(fieldDefinition.min)}"` : "";
  const maxStatusStacks = fieldDefinition.input === "statusStacks" ? getStatusDetails(effect.statusId)?.maxStacks : undefined;
  const max = maxStatusStacks !== undefined ? `max="${escapeAttribute(maxStatusStacks)}"` : "";
  const supportsRange = fieldDefinition.input === "number";
  return `
    <label class="${fieldClassName}">
      <span>${escapeHtml(label)}</span>
      <input type="${supportsRange ? "text" : "number"}" value="${escapeAttribute(value)}" ${supportsRange ? 'inputmode="text"' : `${min} ${max} step="1"`} ${datasetAttributes}>
      ${supportsRange ? '<small class="effect-value-hint">Целое число или диапазон [5, 10]</small>' : ""}
    </label>
  `;
}

export function renderEffectListEditor({
  ownerId,
  effects,
  title = "Эффекты",
  emptyText = "Эффекты не заданы.",
  addLabel = "Добавить эффект",
  definitions,
  getFieldDefinitions,
  getDescription,
  getTypeDataset,
  getFieldDataset,
  getAddDataset,
  getRemoveDataset,
  getRowDataset = () => ({}),
  rowClass = "",
  fieldClass = "",
  editorClass = "",
  headerClass = "",
  listClass = "",
  fieldsClass = "",
  emptyClass = "",
}) {
  const safeEffects = Array.isArray(effects) ? effects : [];
  const safeDefinitions = definitions || [];
  const firstType = safeDefinitions[0]?.type || "";

  function renderRow(effect, index) {
    const type = safeDefinitions.some((definition) => definition.type === effect?.type) ? effect.type : firstType;
    const fields = getFieldDefinitions(type);
    const description = getDescription(type);
    return `
      <div class="trait-effect-row ${rowClass}" data-effect-row ${renderDatasetAttributes(getRowDataset({ ownerId, index }))}>
        <div class="trait-effect-main">
          <label class="editor-field trait-effect-type">
            <span>Эффект</span>
            <select ${renderDatasetAttributes(getTypeDataset({ ownerId, index }))}>
              ${renderEffectTypeOptions({ definitions: safeDefinitions, selectedType: type })}
            </select>
          </label>
          <p class="trait-effect-description">${escapeHtml(description)}</p>
        </div>
        <div class="trait-effect-fields ${fieldsClass}">
          ${
            fields.length
              ? fields.map((field) => renderEffectField({ effect, fieldDefinition: field, dataset: getFieldDataset({ ownerId, index, field }), className: fieldClass })).join("")
              : `<div class="trait-effect-empty ${emptyClass}">Без параметров</div>`
          }
        </div>
        <button class="icon-button danger-button trait-effect-remove" type="button" title="Удалить эффект" ${renderDatasetAttributes(getRemoveDataset({ ownerId, index }))}>x</button>
      </div>
    `;
  }

  return `
    <div class="editor-field wide trait-effects-editor ${editorClass}">
      <div class="trait-effects-header ${headerClass}">
        <span>${escapeHtml(title)}</span>
        <button class="secondary-button compact-button" type="button" ${renderDatasetAttributes(getAddDataset({ ownerId }))}>${escapeHtml(addLabel)}</button>
      </div>
      <div class="trait-effects-list ${listClass}">
        ${
          safeEffects.length
            ? safeEffects.map((effect, index) => renderRow(effect, index)).join("")
            : `<div class="trait-effects-empty ${emptyClass}">${escapeHtml(emptyText)}</div>`
        }
      </div>
    </div>
  `;
}

function getDatasetValue(element, key) {
  return key ? element.dataset[key] : "";
}

function getInputValue(input) {
  return input.type === "checkbox" ? input.checked : input.value;
}

export function createEffectListEditorActions({
  dataset,
  getOwner,
  getListField,
  getContext,
  createEffect,
  getFieldDefinition,
  normalizeFieldValue,
  finishEdit,
}) {
  function getListKey(element) {
    return getDatasetValue(element, dataset.listKey) || "";
  }

  function getEffects(owner, listKey) {
    const field = getListField(listKey);
    if (!field) return null;
    owner[field] = Array.isArray(owner[field]) ? owner[field] : [];
    return owner[field];
  }

  function createListEffect(listKey, type = "") {
    return createEffect({ listKey, type, context: getContext(listKey) });
  }

  function finish(owner, listKey) {
    finishEdit(owner, listKey);
  }

  function handleAddEffect(button) {
    const owner = getOwner(getDatasetValue(button, dataset.add));
    const listKey = getListKey(button);
    const effects = owner ? getEffects(owner, listKey) : null;
    if (!owner || !effects) return;
    effects.push(createListEffect(listKey));
    finish(owner, listKey);
  }

  function handleRemoveEffect(button) {
    const owner = getOwner(getDatasetValue(button, dataset.remove));
    const listKey = getListKey(button);
    const effects = owner ? getEffects(owner, listKey) : null;
    const index = Number(getDatasetValue(button, dataset.index));
    if (!owner || !effects || !Number.isInteger(index) || !effects[index]) return;
    effects.splice(index, 1);
    finish(owner, listKey);
  }

  function handleEffectFieldChange(input) {
    const owner = getOwner(getDatasetValue(input, dataset.owner));
    const listKey = getListKey(input);
    const effects = owner ? getEffects(owner, listKey) : null;
    const index = Number(getDatasetValue(input, dataset.index));
    const field = getDatasetValue(input, dataset.field);
    if (!owner || !effects || !Number.isInteger(index) || !field) return;
    if (!effects[index]) effects[index] = createListEffect(listKey);

    if (field === "type") {
      effects[index] = createListEffect(listKey, input.value);
      finish(owner, listKey);
      return;
    }

    const effect = effects[index];
    const fieldDefinition = getFieldDefinition(effect.type, field);
    if (!fieldDefinition) return;
    if (fieldDefinition.input === "resourceMap" && input.dataset.effectResourceMapKey) {
      effect[field] = normalizeFieldValue(fieldDefinition, {
        ...(effect[field] && typeof effect[field] === "object" && !Array.isArray(effect[field]) ? effect[field] : {}),
        [input.dataset.effectResourceMapKey]: getInputValue(input),
      }, getContext(listKey));
      finish(owner, listKey);
      return;
    }
    effect[field] = normalizeFieldValue(fieldDefinition, getInputValue(input), getContext(listKey));
    clampGrantStatusStacks(effect);
    finish(owner, listKey);
  }

  return {
    handleAddEffect,
    handleRemoveEffect,
    handleEffectFieldChange,
  };
}
