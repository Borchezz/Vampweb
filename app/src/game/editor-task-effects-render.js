import { resourceDefs } from "./state.js";
import { locations, statusEffects, tasks, upgrades } from "./data.js";
import { escapeAttribute, escapeHtml } from "./rules.js";
import {
  TASK_AGENT_PARAMETER_OPTIONS,
  getTaskEffectDescription,
  getTaskEffectDefinitionsForTarget,
  getTaskEffectFieldDefinitions,
  getTaskEffectFieldLabel,
  TASK_RESOURCE_OPTIONS,
  TASK_EFFECT_FIELDS,
} from "./task-effect-registry.js";
import { getTaskOutcomeEffectPreview } from "./task-outcome-preview.js";

const OUTCOME_EFFECT_FIELDS = {
  success: "successEffects",
  failure: "failureEffects",
};

const OUTCOME_LABELS = {
  success: "Эффекты успеха",
  failure: "Эффекты провала",
};

function renderEffectTypeOptions(selectedType, target) {
  return getTaskEffectDefinitionsForTarget(target)
    .map((definition) => {
      const selected = definition.type === selectedType ? "selected" : "";
      return `<option value="${escapeAttribute(definition.type)}" ${selected}>${escapeHtml(definition.label)}</option>`;
    })
    .join("");
}

function renderResourceOptions(selectedResource) {
  return Object.entries(resourceDefs)
    .map(([resource, def]) => {
      const selected = resource === selectedResource ? "selected" : "";
      return `<option value="${escapeAttribute(resource)}" ${selected}>${escapeHtml(def.label)}</option>`;
    })
    .join("");
}

function renderTaskResourceOptions(selectedResource) {
  return TASK_RESOURCE_OPTIONS.map((option) => {
    const selected = option.value === selectedResource ? "selected" : "";
    return `<option value="${escapeAttribute(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function renderAgentParameterOptions(selectedParameter) {
  return TASK_AGENT_PARAMETER_OPTIONS.map((option) => {
    const selected = option.value === selectedParameter ? "selected" : "";
    return `<option value="${escapeAttribute(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
}

function renderTaskOptions(selectedTask) {
  return tasks
    .map((task) => {
      const selected = task.id === selectedTask ? "selected" : "";
      return `<option value="${escapeAttribute(task.id)}" ${selected}>${escapeHtml(task.name || task.id)}</option>`;
    })
    .join("");
}

function renderUpgradeOptions(selectedUpgrade, allowAny = false) {
  const options = [
    allowAny
      ? `<option value="any" ${selectedUpgrade === "any" ? "selected" : ""}>any</option>`
      : `<option value="" ${selectedUpgrade ? "" : "selected"}>Нет</option>`,
    ...upgrades.map((upgrade) => {
      const selected = upgrade.id === selectedUpgrade ? "selected" : "";
      return `<option value="${escapeAttribute(upgrade.id)}" ${selected}>${escapeHtml(upgrade.name || upgrade.id)}</option>`;
    }),
  ];
  return options.join("");
}

function renderRoundingOptions(selectedRounding) {
  const options = [
    { value: "ceil", label: "Вверх" },
    { value: "floor", label: "Вниз" },
    { value: "round", label: "Математически" },
  ];
  return options
    .map((option) => `<option value="${option.value}" ${option.value === selectedRounding ? "selected" : ""}>${option.label}</option>`)
    .join("");
}

function renderStatusOptions(selectedStatus) {
  return statusEffects
    .map((status) => `<option value="${escapeAttribute(status.id)}" ${status.id === selectedStatus ? "selected" : ""}>${escapeHtml(status.name)}</option>`)
    .join("");
}

function renderStatusDetails(statusId) {
  const status = statusEffects.find((item) => item.id === statusId);
  return status ? `<small class="status-effect-details">${escapeHtml(status.description)} · ${status.duration} дн. · до ${status.maxStacks} стаков</small>` : "";
}

function getTaskLocation(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  return locations.find((location) => location.id === task?.locationId);
}

function renderLocationMechanicOptions(taskId, input, value, shopId = "") {
  const mechanics = getTaskLocation(taskId)?.mechanics || [];
  if (input === TASK_EFFECT_FIELDS.locationCounter || input === TASK_EFFECT_FIELDS.locationScale) {
    const type = input === TASK_EFFECT_FIELDS.locationCounter ? "counter" : "scale";
    return mechanics
      .filter((mechanic) => mechanic.type === type)
      .map((mechanic) => `<option value="${escapeAttribute(mechanic.id)}" ${mechanic.id === value ? "selected" : ""}>${escapeHtml(mechanic.name || type)}</option>`)
      .join("") || '<option value="">Нет подходящей механики</option>';
  }
  const shops = mechanics.filter((mechanic) => mechanic.type === "shop");
  if (input === TASK_EFFECT_FIELDS.locationShop) {
    return shops.map((shop) => `<option value="${escapeAttribute(shop.id)}" ${shop.id === value ? "selected" : ""}>${escapeHtml(shop.name || "Магазин")}</option>`).join("")
      || '<option value="">Нет магазинов</option>';
  }
  const selectedShop = shops.find((shop) => shop.id === shopId) || shops[0];
  return (selectedShop?.sellOffers || []).map((offer) => `<option value="${escapeAttribute(offer.id)}" ${offer.id === value ? "selected" : ""}>${escapeHtml(offer.resource || "Товар")}</option>`).join("")
    || '<option value="">Нет товаров магазина</option>';
}

function renderTaskEffectField(taskId, outcome, effect, index, fieldDefinition) {
  const field = fieldDefinition.key;
  const value = effect[field] ?? "";
  const label = fieldDefinition.label || getTaskEffectFieldLabel(effect.type, field);
  const baseAttrs = `
    data-task-effect-field="${escapeAttribute(field)}"
    data-task-effect-task="${escapeAttribute(taskId)}"
    data-task-effect-outcome="${escapeAttribute(outcome)}"
    data-task-effect-index="${escapeAttribute(index)}"`;

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.resource) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderResourceOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.standardResource) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderTaskResourceOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.agentParameter) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderAgentParameterOptions(value)}</select>
      </label>
    `;
  }

  if ([TASK_EFFECT_FIELDS.locationCounter, TASK_EFFECT_FIELDS.locationScale, TASK_EFFECT_FIELDS.locationShop, TASK_EFFECT_FIELDS.locationShopOffer].includes(fieldDefinition.input)) {
    return `<label class="editor-field trait-effect-field task-effect-field"><span>${escapeHtml(label)}</span><select ${baseAttrs}>${renderLocationMechanicOptions(taskId, fieldDefinition.input, value, effect.shopId)}</select></label>`;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.task) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderTaskOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.upgrade) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderUpgradeOptions(value, fieldDefinition.allowAny)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.status) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderStatusOptions(value)}</select>
        ${renderStatusDetails(value)}
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.rounding) {
    return `
      <label class="editor-field trait-effect-field task-effect-field">
        <span>${escapeHtml(label)}</span>
        <select ${baseAttrs}>${renderRoundingOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TASK_EFFECT_FIELDS.boolean) {
    return `
      <label class="editor-field trait-effect-field task-effect-field checkbox-field">
        <span>${escapeHtml(label)}</span>
        <input type="checkbox" ${value ? "checked" : ""} ${baseAttrs}>
      </label>
    `;
  }

  const min = fieldDefinition.min !== undefined ? `min="${escapeAttribute(fieldDefinition.min)}"` : "";
  const max = fieldDefinition.input === TASK_EFFECT_FIELDS.statusStacks ? statusEffects.find((status) => status.id === effect.statusId)?.maxStacks : undefined;
  const maxAttribute = max !== undefined ? `max="${escapeAttribute(max)}"` : "";
  const supportsRange = fieldDefinition.input === TASK_EFFECT_FIELDS.number;
  return `
    <label class="editor-field trait-effect-field task-effect-field">
      <span>${escapeHtml(label)}</span>
      <input type="${supportsRange ? "text" : "number"}" value="${escapeAttribute(value)}" ${supportsRange ? 'inputmode="text"' : `${min} ${maxAttribute} step="1"`} ${baseAttrs}>
      ${supportsRange ? '<small class="effect-value-hint">Целое число или диапазон [5, 10]</small>' : ""}
    </label>
  `;
}

function renderTaskEffectRow(taskId, outcome, effect, index) {
  const definitions = getTaskEffectDefinitionsForTarget(outcome);
  const type = definitions.some((definition) => definition.type === effect?.type) ? effect.type : definitions[0]?.type || "";
  const fields = getTaskEffectFieldDefinitions(type);
  const description = getTaskEffectDescription(type);
  return `
    <div class="trait-effect-row task-effect-row" data-task-effect-row>
      <div class="trait-effect-main">
        <label class="editor-field trait-effect-type task-effect-type">
          <span>Эффект</span>
          <select
            data-task-effect-field="type"
            data-task-effect-task="${escapeAttribute(taskId)}"
            data-task-effect-outcome="${escapeAttribute(outcome)}"
            data-task-effect-index="${escapeAttribute(index)}">
            ${renderEffectTypeOptions(type, outcome)}
          </select>
        </label>
        <p class="trait-effect-description task-effect-description">${escapeHtml(description)}</p>
      </div>
      <div class="trait-effect-fields task-effect-fields">
        ${
          fields.length
            ? fields.map((field) => renderTaskEffectField(taskId, outcome, effect, index, field)).join("")
            : `<div class="trait-effect-empty task-effect-empty">Без параметров</div>`
        }
      </div>
      <button class="icon-button danger-button trait-effect-remove task-effect-remove" type="button" title="Удалить эффект" data-task-effect-remove="${escapeAttribute(taskId)}" data-task-effect-outcome="${escapeAttribute(outcome)}" data-task-effect-index="${escapeAttribute(index)}">x</button>
    </div>
  `;
}

function renderTaskOutcomePreview(task, outcome) {
  const effects = getTaskOutcomeEffectPreview(task, outcome);
  if (!effects.length) return '<p class="task-effects-preview-empty">Нет эффектов.</p>';
  return `<ul class="task-effects-preview-list">${effects
    .map((effect) => `<li><span>${escapeHtml(effect.label)}</span><strong>${escapeHtml(effect.value)}</strong></li>`)
    .join("")}</ul>`;
}

function renderTaskEffectList(task, outcome) {
  const field = OUTCOME_EFFECT_FIELDS[outcome];
  const effects = Array.isArray(task[field]) ? task[field] : [];
  return `
    <div class="editor-field wide trait-effects-editor task-effects-editor">
      <div class="trait-effects-header task-effects-header">
        <span>${OUTCOME_LABELS[outcome]}</span>
        <button class="secondary-button compact-button" type="button" data-task-effect-add="${escapeAttribute(task.id)}" data-task-effect-outcome="${escapeAttribute(outcome)}">Добавить эффект</button>
      </div>
      <div class="task-effects-preview" aria-label="Описание ${OUTCOME_LABELS[outcome].toLowerCase()}">${renderTaskOutcomePreview(task, outcome)}</div>
      <div class="trait-effects-list task-effects-list">
        ${
          effects.length
            ? effects.map((effect, index) => renderTaskEffectRow(task.id, outcome, effect, index)).join("")
            : `<div class="trait-effects-empty task-effects-empty">Эффекты не заданы.</div>`
        }
      </div>
    </div>
  `;
}

export function renderTaskOutcomeEffectsEditor(task) {
  return `
    ${renderTaskEffectList(task, "success")}
    ${renderTaskEffectList(task, "failure")}
  `;
}
