import { resourceDefs, statDefs } from "./state.js";
import { statusEffects } from "./data.js";
import { escapeAttribute, escapeHtml } from "./rules.js";
import {
  TRAIT_AGENT_PARAMETER_OPTIONS,
  getTraitEffectDescription,
  getTraitEffectFieldDefinitions,
  getTraitEffectLabel,
  TRAIT_EFFECT_FIELD_INPUTS,
  TRAIT_EFFECT_TYPES,
} from "./trait-effect-registry.js";

function renderTraitEffectTypeOptions(selectedType) {
  return TRAIT_EFFECT_TYPES.map((type) => {
    const selected = type === selectedType ? "selected" : "";
    return `<option value="${escapeAttribute(type)}" ${selected}>${escapeHtml(getTraitEffectLabel(type))}</option>`;
  }).join("");
}

function renderResourceOptions(selectedResource) {
  return Object.entries(resourceDefs)
    .map(([resource, def]) => {
      const selected = resource === selectedResource ? "selected" : "";
      return `<option value="${escapeAttribute(resource)}" ${selected}>${escapeHtml(def.label)}</option>`;
    })
    .join("");
}

function renderStatOptions(selectedStat) {
  return Object.entries(statDefs)
    .filter(([stat]) => stat !== "none")
    .map(([stat, def]) => {
      const selected = stat === selectedStat ? "selected" : "";
      return `<option value="${escapeAttribute(stat)}" ${selected}>${escapeHtml(def.full || def.label)}</option>`;
    })
    .join("");
}

function renderAgentParameterOptions(selectedParameter) {
  return TRAIT_AGENT_PARAMETER_OPTIONS.map((option) => {
    const selected = option.value === selectedParameter ? "selected" : "";
    return `<option value="${escapeAttribute(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
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

function renderTraitEffectField(traitId, effect, index, fieldDefinition) {
  const field = fieldDefinition.key;
  const value = effect[field] ?? "";
  const baseAttrs = `
    data-trait-effect-field="${escapeAttribute(field)}"
    data-trait-effect-trait="${escapeAttribute(traitId)}"
    data-trait-effect-index="${escapeAttribute(index)}"`;

  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.resource) {
    return `
      <label class="editor-field trait-effect-field">
        <span>${escapeHtml(fieldDefinition.label)}</span>
        <select ${baseAttrs}>${renderResourceOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.agentParameter) {
    return `
      <label class="editor-field trait-effect-field">
        <span>${escapeHtml(fieldDefinition.label)}</span>
        <select ${baseAttrs}>${renderAgentParameterOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.stat) {
    return `
      <label class="editor-field trait-effect-field">
        <span>${escapeHtml(fieldDefinition.label)}</span>
        <select ${baseAttrs}>${renderStatOptions(value)}</select>
      </label>
    `;
  }

  if (fieldDefinition.input === TRAIT_EFFECT_FIELD_INPUTS.status) {
    return `
      <label class="editor-field trait-effect-field">
        <span>${escapeHtml(fieldDefinition.label)}</span>
        <select ${baseAttrs}>${renderStatusOptions(value)}</select>
        ${renderStatusDetails(value)}
      </label>
    `;
  }

  const min = fieldDefinition.min ? `min="${escapeAttribute(fieldDefinition.min)}"` : "";
  const max = fieldDefinition.key === "stacks" ? statusEffects.find((status) => status.id === effect.statusId)?.maxStacks : undefined;
  const maxAttribute = max !== undefined ? `max="${escapeAttribute(max)}"` : "";
  return `
    <label class="editor-field trait-effect-field">
      <span>${escapeHtml(fieldDefinition.label)}</span>
      <input type="number" value="${escapeAttribute(value)}" ${min} ${maxAttribute} step="1" ${baseAttrs}>
    </label>
  `;
}

function renderTraitEffectRow(traitId, effect, index) {
  const type = TRAIT_EFFECT_TYPES.includes(effect?.type) ? effect.type : TRAIT_EFFECT_TYPES[0];
  const fields = getTraitEffectFieldDefinitions(type);
  const description = getTraitEffectDescription(type);
  return `
    <div class="trait-effect-row" data-trait-effect-row>
      <div class="trait-effect-main">
        <label class="editor-field trait-effect-type">
          <span>Эффект</span>
          <select
            data-trait-effect-field="type"
            data-trait-effect-trait="${escapeAttribute(traitId)}"
            data-trait-effect-index="${escapeAttribute(index)}">
            ${renderTraitEffectTypeOptions(type)}
          </select>
        </label>
        <p class="trait-effect-description">${escapeHtml(description)}</p>
      </div>
      <div class="trait-effect-fields">
        ${
          fields.length
            ? fields.map((field) => renderTraitEffectField(traitId, effect, index, field)).join("")
            : `<div class="trait-effect-empty">Без параметров</div>`
        }
      </div>
      <button class="icon-button danger-button trait-effect-remove" type="button" title="Удалить эффект" data-trait-effect-remove="${escapeAttribute(traitId)}" data-trait-effect-index="${escapeAttribute(index)}">x</button>
    </div>
  `;
}

export function renderTraitEffectsEditor(trait) {
  const effects = Array.isArray(trait.effects) ? trait.effects : [];
  return `
    <div class="editor-field wide trait-effects-editor">
      <div class="trait-effects-header">
        <span>Эффекты</span>
        <button class="secondary-button compact-button" type="button" data-trait-effect-add="${escapeAttribute(trait.id)}">Добавить эффект</button>
      </div>
      <div class="trait-effects-list">
        ${
          effects.length
            ? effects.map((effect, index) => renderTraitEffectRow(trait.id, effect, index)).join("")
            : `<div class="trait-effects-empty">Эффекты не заданы.</div>`
        }
      </div>
    </div>
  `;
}
