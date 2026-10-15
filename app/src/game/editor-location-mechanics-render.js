import { statusEffects, tasks, upgrades } from "./data.js";
import { escapeAttribute, escapeHtml } from "./rules.js";
import { STANDARD_RESOURCE_OPTIONS } from "./resource-catalog.js";
import {
  getLocationMechanicEffectDefinition,
  LOCATION_MECHANIC_EFFECT_DEFINITIONS,
} from "./location-mechanic-effect-registry.js";
import {
  LOCATION_THRESHOLD_DIRECTION_OPTIONS,
  LOCATION_THRESHOLD_MODE_OPTIONS,
  LOCATION_THRESHOLD_REPEAT_OPTIONS,
} from "./location-mechanic-contract.js";
import {
  getTaskEffectDefinitionsForTarget,
  getTaskEffectFieldDefinitions,
  TASK_AGENT_PARAMETER_OPTIONS,
  TASK_EFFECT_FIELDS,
  TASK_RESOURCE_OPTIONS,
} from "./task-effect-registry.js";

function options(items, selected) {
  return items.map((item) => `<option value="${escapeAttribute(item.value)}" ${String(item.value) === String(selected) ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
}

function mechanicAttrs(locationId, mechanic) {
  return `data-location-mechanic-location="${escapeAttribute(locationId)}" data-location-mechanic-id="${escapeAttribute(mechanic.id)}"`;
}

function thresholdAttrs(locationId, mechanic, threshold) {
  return `${mechanicAttrs(locationId, mechanic)} data-location-threshold-id="${escapeAttribute(threshold.id)}"`;
}

function effectAttrs(locationId, mechanic, threshold, effectIndex, field) {
  return `${thresholdAttrs(locationId, mechanic, threshold)} data-location-threshold-effect-index="${effectIndex}" data-location-threshold-effect-field="${escapeAttribute(field)}"`;
}

function renderSelectField(label, attrs, entries, value) {
  return `<label class="editor-field"><span>${escapeHtml(label)}</span><select ${attrs}>${options(entries, value)}</select></label>`;
}

function renderTaskEffectField(location, effect, field, attrs) {
  const value = effect?.[field.key] ?? "";
  if (field.input === TASK_EFFECT_FIELDS.agentParameter) return renderSelectField(field.label, attrs, TASK_AGENT_PARAMETER_OPTIONS, value);
  if (field.input === TASK_EFFECT_FIELDS.standardResource) return renderSelectField(field.label, attrs, TASK_RESOURCE_OPTIONS, value);
  if (field.input === TASK_EFFECT_FIELDS.upgrade) {
    const entries = [...(field.allowAny ? [{ value: "any", label: "Любой" }] : []), ...upgrades.map((item) => ({ value: item.id, label: item.name || item.id }))];
    return renderSelectField(field.label, attrs, entries, value);
  }
  if (field.input === TASK_EFFECT_FIELDS.status) return renderSelectField(field.label, attrs, statusEffects.map((item) => ({ value: item.id, label: item.name || item.id })), value);
  if (field.input === TASK_EFFECT_FIELDS.task) return renderSelectField(field.label, attrs, tasks.filter((item) => item.locationId === location.id).map((item) => ({ value: item.id, label: item.name || item.id })), value);
  if (field.input === TASK_EFFECT_FIELDS.locationCounter || field.input === TASK_EFFECT_FIELDS.locationScale) {
    const type = field.input === TASK_EFFECT_FIELDS.locationCounter ? "counter" : "scale";
    return renderSelectField(field.label, attrs, (location.mechanics || []).filter((item) => item.type === type).map((item) => ({ value: item.id, label: item.name })), value);
  }
  if (field.input === TASK_EFFECT_FIELDS.locationShop) return renderSelectField(field.label, attrs, (location.mechanics || []).filter((item) => item.type === "shop").map((item) => ({ value: item.id, label: item.name })), value);
  if (field.input === TASK_EFFECT_FIELDS.locationShopOffer) {
    const shop = (location.mechanics || []).find((item) => item.id === effect.shopId) || (location.mechanics || []).find((item) => item.type === "shop");
    return renderSelectField(field.label, attrs, (shop?.sellOffers || []).map((item) => ({ value: item.id, label: item.resource })), value);
  }
  if (field.input === TASK_EFFECT_FIELDS.boolean) return `<label class="editor-field editor-checkbox"><input type="checkbox" ${value ? "checked" : ""} ${attrs}><span>${escapeHtml(field.label)}</span></label>`;
  return `<label class="editor-field"><span>${escapeHtml(field.label)}</span><input type="text" inputmode="text" value="${escapeAttribute(value)}" ${attrs}><small class="effect-value-hint">Целое число или диапазон [5, 10]</small></label>`;
}

function renderNestedTaskEffect(location, effect, baseAttrs) {
  const nested = effect.effect || { type: "resource_delta", resource: "money", amount: 1 };
  const definitions = getTaskEffectDefinitionsForTarget(effect.outcome || "success");
  const typeOptions = definitions.map((definition) => ({ value: definition.type, label: definition.label }));
  return `<div class="location-threshold-nested-effect">
    ${renderSelectField("Эффект задачи", `${baseAttrs("effect.type")}`, typeOptions, nested.type)}
    ${getTaskEffectFieldDefinitions(nested.type).map((field) => renderTaskEffectField(location, nested, field, baseAttrs(`effect.${field.key}`))).join("")}
  </div>`;
}

function renderThresholdEffectField(location, mechanic, threshold, effect, effectIndex, field) {
  const attrs = (key = field.key) => effectAttrs(location.id, mechanic, threshold, effectIndex, key);
  const value = effect[field.key] ?? field.default ?? "";
  if (field.input === "number") return `<label class="editor-field"><span>${escapeHtml(field.label)}</span><input type="text" inputmode="text" value="${escapeAttribute(value)}" ${attrs()}><small class="effect-value-hint">Целое число или диапазон [5, 10]</small></label>`;
  if (field.input === "boolean") return `<label class="editor-field editor-checkbox"><input type="checkbox" ${value ? "checked" : ""} ${attrs()}><span>${escapeHtml(field.label)}</span></label>`;
  if (field.input === "select") return renderSelectField(field.label, attrs(), field.options, value);
  if (field.input === "task") return renderSelectField(field.label, attrs(), tasks.filter((item) => item.locationId === location.id).map((item) => ({ value: item.id, label: item.name || item.id })), value);
  if (field.input === "mechanic") return renderSelectField(field.label, attrs(), (location.mechanics || []).filter((item) => item.type !== "shop").map((item) => ({ value: item.id, label: item.name })), value);
  if (field.input === "shop") return renderSelectField(field.label, attrs(), (location.mechanics || []).filter((item) => item.type === "shop").map((item) => ({ value: item.id, label: item.name })), value);
  if (field.input === "offer") {
    const shop = (location.mechanics || []).find((item) => item.id === effect.shopId) || (location.mechanics || []).find((item) => item.type === "shop");
    return renderSelectField(field.label, attrs(), (shop?.sellOffers || []).map((item) => ({ value: item.id, label: item.resource })), value);
  }
  if (field.input === "taskEffect") return renderNestedTaskEffect(location, effect, attrs);
  return "";
}

function renderThresholdEffect(location, mechanic, threshold, effect, effectIndex) {
  const definition = getLocationMechanicEffectDefinition(effect.type) || LOCATION_MECHANIC_EFFECT_DEFINITIONS[0];
  const attrs = thresholdAttrs(location.id, mechanic, threshold);
  return `<div class="trait-effect-row location-threshold-effect">
    <div class="trait-effect-main">
      ${renderSelectField("Эффект", effectAttrs(location.id, mechanic, threshold, effectIndex, "type"), LOCATION_MECHANIC_EFFECT_DEFINITIONS.map((item) => ({ value: item.type, label: item.label })), definition.type)}
      <p class="trait-effect-description">${escapeHtml(definition.description)}</p>
    </div>
    <div class="trait-effect-fields">${definition.fields.map((field) => renderThresholdEffectField(location, mechanic, threshold, effect, effectIndex, field)).join("")}</div>
    <button class="icon-button danger-button" type="button" title="Удалить эффект" data-location-mechanic-action="threshold-effect-remove" data-location-threshold-effect-index="${effectIndex}" ${attrs}>x</button>
  </div>`;
}

function renderThresholds(location, mechanic) {
  const attrs = mechanicAttrs(location.id, mechanic);
  return `<div class="location-mechanic-thresholds">
    <div class="editor-section-header"><h4>Пороги</h4><button class="secondary-button compact-button" type="button" data-location-mechanic-action="threshold-add" ${attrs}>Добавить порог</button></div>
    ${(mechanic.thresholds || []).map((threshold) => {
      const thresholdData = thresholdAttrs(location.id, mechanic, threshold);
      const value = Math.trunc(Number(threshold.value) || 0);
      const title = `Порог ${value >= 0 ? "+" : ""}${value}`;
      return `<section class="location-mechanic-threshold">
        <h4>${escapeHtml(title)}</h4>
        <div class="editor-grid">
          <label class="editor-field"><span>Значение</span><input type="number" value="${escapeAttribute(threshold.value)}" data-location-mechanic-threshold-field="value" ${thresholdData}></label>
          ${renderSelectField("Направление", `data-location-mechanic-threshold-field="direction" ${thresholdData}`, LOCATION_THRESHOLD_DIRECTION_OPTIONS, threshold.direction)}
          ${renderSelectField("Повтор", `data-location-mechanic-threshold-field="repeat" ${thresholdData}`, LOCATION_THRESHOLD_REPEAT_OPTIONS, threshold.repeat)}
          ${renderSelectField("Режим", `data-location-mechanic-threshold-field="mode" ${thresholdData}`, LOCATION_THRESHOLD_MODE_OPTIONS, threshold.mode)}
        </div>
        <div class="editor-section-header"><h4>Эффекты порога</h4><button class="secondary-button compact-button" type="button" data-location-mechanic-action="threshold-effect-add" ${thresholdData}>Добавить эффект</button></div>
        ${(threshold.effects || []).map((effect, index) => renderThresholdEffect(location, mechanic, threshold, effect, index)).join("") || '<p class="editor-note">Эффектов пока нет.</p>'}
        <button class="secondary-button compact-button" type="button" data-location-mechanic-action="threshold-remove" ${thresholdData}>Удалить порог</button>
      </section>`;
    }).join("") || '<p class="editor-note">Порогов пока нет.</p>'}
  </div>`;
}

function renderOffers(location, mechanic, type) {
  const field = type === "sell" ? "sellOffers" : "buyOffers";
  const attrs = mechanicAttrs(location.id, mechanic);
  return `<div class="location-mechanic-offers"><div class="editor-section-header"><h4>${type === "sell" ? "Продаёт игроку" : "Покупает у игрока"}</h4><button class="secondary-button compact-button" type="button" data-location-mechanic-action="offer-add" data-location-mechanic-offer-type="${type}" ${attrs}>Добавить</button></div>
    ${(mechanic[field] || []).map((offer) => {
      const offerAttrs = `${attrs} data-location-offer-id="${escapeAttribute(offer.id)}" data-location-mechanic-offer-type="${type}"`;
      return `<div class="location-mechanic-offer">
        ${renderSelectField("Ресурс", `data-location-mechanic-offer-field="resource" ${offerAttrs}`, STANDARD_RESOURCE_OPTIONS.filter((item) => item.value !== "money"), offer.resource)}
        <label class="editor-field"><span>Цена, $</span><input type="number" min="1" value="${offer.price}" data-location-mechanic-offer-field="price" ${offerAttrs}></label>
        ${type === "sell" ? `<label class="editor-field"><span>В наличии</span><input type="number" min="0" value="${offer.maxStock}" data-location-mechanic-offer-field="maxStock" ${offerAttrs}></label>${renderSelectField("Восполнение", `data-location-mechanic-offer-field="refill" ${offerAttrs}`, [{ value: "none", label: "Нет" }, { value: "daily", label: "Каждый день" }, { value: "weekly", label: "Раз в неделю" }], offer.refill)}` : ""}
        <label class="editor-field editor-checkbox"><input type="checkbox" ${offer.locked ? "checked" : ""} data-location-mechanic-offer-field="locked" ${offerAttrs}><span>Недоступен</span></label>
        <button class="secondary-button compact-button" type="button" data-location-mechanic-action="offer-remove" ${offerAttrs}>Удалить</button>
      </div>`;
    }).join("") || '<p class="editor-note">Предложений пока нет.</p>'}
  </div>`;
}

function renderMechanic(location, mechanic) {
  const attrs = mechanicAttrs(location.id, mechanic);
  const remove = `<button class="secondary-button compact-button" type="button" data-location-mechanic-remove ${attrs}>Удалить</button>`;
  const name = `<label class="editor-field"><span>Название</span><input value="${escapeAttribute(mechanic.name)}" data-location-mechanic-field="name" ${attrs}></label>`;
  if (mechanic.type === "shop") return `<section class="location-mechanic-editor"><div class="editor-section-header"><h4>Магазин</h4>${remove}</div><div class="editor-grid">${name}</div>${renderOffers(location, mechanic, "sell")}${renderOffers(location, mechanic, "buy")}</section>`;
  const numeric = mechanic.type === "scale"
    ? `<label class="editor-field"><span>Минимум</span><input type="number" value="${mechanic.min}" data-location-mechanic-field="min" ${attrs}></label><label class="editor-field"><span>Максимум</span><input type="number" value="${mechanic.max}" data-location-mechanic-field="max" ${attrs}></label>`
    : `${renderSelectField("Подтип", `data-location-mechanic-field="counterType" ${attrs}`, ["fillable", "self_filling", "decaying", "fillable_decaying"].map((value) => ({ value, label: value })), mechanic.counterType)}<label class="editor-field"><span>Деления</span><input type="number" min="1" max="12" value="${mechanic.segments}" data-location-mechanic-field="segments" ${attrs}></label>`;
  return `<section class="location-mechanic-editor"><div class="editor-section-header"><h4>${mechanic.type === "scale" ? "Шкала" : "Счётчик"}</h4>${remove}</div><div class="editor-grid">${name}${numeric}<label class="editor-field"><span>Стартовое значение</span><input type="number" value="${mechanic.value}" data-location-mechanic-field="value" ${attrs}></label></div>${renderThresholds(location, mechanic)}</section>`;
}

export function renderLocationMechanicsEditor(location) {
  return `<section class="editor-section">
    <div class="editor-section-header"><h3>Механики локации</h3><div class="editor-inline-actions">
      <button class="secondary-button compact-button" type="button" data-location-mechanic-add="${escapeAttribute(location.id)}" data-location-mechanic-type="counter">Счётчик</button>
      <button class="secondary-button compact-button" type="button" data-location-mechanic-add="${escapeAttribute(location.id)}" data-location-mechanic-type="scale">Шкала</button>
      <button class="secondary-button compact-button" type="button" data-location-mechanic-add="${escapeAttribute(location.id)}" data-location-mechanic-type="shop">Магазин</button>
    </div></div>
    ${(location.mechanics || []).map((mechanic) => renderMechanic(location, mechanic)).join("") || '<p class="editor-note">Добавьте механику для этой локации.</p>'}
  </section>`;
}
