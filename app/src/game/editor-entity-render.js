import { editorState, gameSettings, resourceDefs, runtime, statDefs } from "./state.js";
import { activities, eventDeck, locations, paths, statusEffects, tasks, traitCatalog, upgrades, zones } from "./data.js";
import { getEntityCreateDraft, isEntityCreateFormOpen } from "./editor-entity-crud.js";
import { escapeAttribute, escapeHtml, getZone } from "./rules.js";
import { getPathBend, getPathEndpoints, isPathBendEnabled } from "./map-utils.js";
import { renderCheckboxField, renderSelectField, renderTextareaField, renderTextField } from "./editor-fields.js";
import { getSympathyScaleSections, getSympathySectionInfo, getSympathyTraitEntries } from "./agent-traits.js";
import { getTraitDescription, getTraitDisplayName, getTraitOptionEntries, isTraitRefSelected } from "./trait-catalog.js";
import { renderTaskOutcomeEffectsEditor } from "./editor-task-effects-render.js";
import { renderTraitEffectsEditor } from "./editor-trait-effects-render.js";
import { renderUpgradeEffectsEditor } from "./editor-upgrade-effects-render.js";
import { renderEventEffectsEditor } from "./editor-event-effects-render.js";
import { renderStatusEffectsEditor } from "./editor-status-effects-render.js";
import { renderActivityEffectsEditor } from "./editor-activity-effects-render.js";
import { getTaskDifficultyLabel } from "./task-difficulty-settings.js";
import { renderLocationMechanicsEditor } from "./editor-location-mechanics-render.js";
import { renderLocationVisibilityEditor } from "./editor-location-visibility-render.js";
import {
  activityCreateFieldMetadata,
  getActivityEditorFieldMetadata,
  getAgentCreateFieldMetadata,
  getAgentEditorFieldMetadata,
  getBarSettingsEditorFieldMetadata,
  getCreateFieldMetadataList,
  getEditorFieldMetadataList,
  getLocationCreateFieldMetadata,
  getLocationEditorFieldMetadata,
  getPathCreateFieldMetadata,
  getPathEditorFieldMetadata,
  getPathGameplayEditorFieldMetadata,
  getResourceEditorFieldMetadata,
  getTaskEditorFieldMetadata,
  taskCreateFieldMetadata,
  statusCreateFieldMetadata,
  statusEditorFieldMetadata,
  traitCreateFieldMetadata,
  traitEditorFieldMetadata,
  zoneCreateFieldMetadata,
  zoneEditorFieldMetadata,
} from "./editor-entity-metadata.js";

function renderAgentTraitSelector(agent) {
  const selectedTraits = Array.isArray(agent.traits) ? agent.traits : [];
  const traitOptions = getTraitOptionEntries(selectedTraits);
  const isOpen = editorState.agentTraitMenuAgentId === agent.id;
  const agentId = escapeAttribute(agent.id);
  const menuId = `agent-traits-menu-${agentId}`;
  const selectedText = selectedTraits.length ? selectedTraits.map(getTraitDisplayName).join(", ") : "Не выбраны";

  return `
    <div class="editor-field wide agent-traits-editor">
      <div class="agent-traits-toolbar">
        <span>Черты</span>
        <button class="secondary-button compact-button ${isOpen ? "active" : ""}"
          type="button"
          data-agent-traits-menu-toggle="${agentId}"
          aria-expanded="${isOpen ? "true" : "false"}"
          aria-controls="${menuId}">
          ${isOpen ? "Закрыть черты" : "Редактировать черты"}
        </button>
      </div>
      <div class="agent-traits-selected">${escapeHtml(selectedText)}</div>
      ${
        isOpen
          ? `<div class="agent-traits-menu" id="${menuId}" role="group" aria-label="Выбор черт агента">
              ${traitOptions
                .map((option) => {
                  const description = option.description || "Пользовательская черта агента.";
                  return `
                    <label class="agent-trait-option" title="${escapeAttribute(description)}">
                      <input type="checkbox"
                        value="${escapeAttribute(option.value)}"
                        data-agent-trait-toggle
                        data-agent-trait-agent="${agentId}"
                        ${isTraitRefSelected(selectedTraits, option.value) ? "checked" : ""}>
                      <span class="agent-trait-copy">
                        <strong>${escapeHtml(option.label)}</strong>
                        <small>${escapeHtml(description)}</small>
                      </span>
                    </label>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderSympathySectionOptions(selectedSection) {
  return getSympathyScaleSections()
    .map((section) => {
      return `<option value="${escapeAttribute(section.section)}" ${section.section === selectedSection ? "selected" : ""}>${escapeHtml(section.label)}</option>`;
    })
    .join("");
}

function renderCreateTextField(scope, field, label, value, options = {}) {
  const type = options.type || "text";
  const required = options.required ? "required" : "";
  return `
    <label class="editor-field">
      <span>${label}</span>
      <input type="${type}" value="${escapeAttribute(value ?? "")}" ${required} data-editor-create-scope="${scope}" data-editor-create-field="${field}">
    </label>
  `;
}

function renderCreateSelectField(scope, field, label, value, options) {
  return `
    <label class="editor-field">
      <span>${label}</span>
      <select data-editor-create-scope="${scope}" data-editor-create-field="${field}">
        ${options
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

function renderCreateFieldFromMetadata(scope, draft, fieldMetadata) {
  const value = draft[fieldMetadata.field] ?? fieldMetadata.fallback ?? "";
  if (fieldMetadata.control === "select") {
    return renderCreateSelectField(scope, fieldMetadata.field, fieldMetadata.label, value, fieldMetadata.options || []);
  }
  return renderCreateTextField(scope, fieldMetadata.field, fieldMetadata.label, value, {
    required: fieldMetadata.required,
    type: fieldMetadata.control === "number" ? "number" : "text",
  });
}

function getMetadataFieldValue(entity, fieldMetadata) {
  if (typeof fieldMetadata.getValue === "function") return fieldMetadata.getValue(entity);
  const value = entity[fieldMetadata.field];
  if (fieldMetadata.control === "jsonArray") return JSON.stringify(value || fieldMetadata.fallback || []);
  if (fieldMetadata.control === "jsonObject") return JSON.stringify(value || fieldMetadata.fallback || {});
  if (fieldMetadata.control === "nullableJsonObject") {
    return value && typeof value === "object" ? JSON.stringify(value || {}) : fieldMetadata.fallback || "";
  }
  return value ?? fieldMetadata.fallback ?? "";
}

function renderFieldFromMetadata(scope, id, entity, fieldMetadata) {
  const value = getMetadataFieldValue(entity, fieldMetadata);
  if (fieldMetadata.control === "select") {
    return renderSelectField(scope, id, fieldMetadata.field, fieldMetadata.label, value, {
      entries: typeof fieldMetadata.getOptions === "function" ? fieldMetadata.getOptions(entity) : fieldMetadata.options || [],
      disabled: typeof fieldMetadata.disabled === "function" ? fieldMetadata.disabled(entity) : Boolean(fieldMetadata.disabled),
    });
  }
  if (fieldMetadata.control === "checkbox") {
    return renderCheckboxField(scope, id, fieldMetadata.field, fieldMetadata.label, Boolean(value));
  }
  if (fieldMetadata.control === "textarea" || fieldMetadata.control === "jsonArray" || fieldMetadata.control === "jsonObject" || fieldMetadata.control === "nullableJsonObject") {
    return renderTextareaField(scope, id, fieldMetadata.field, fieldMetadata.label, value);
  }
  return renderTextField(scope, id, fieldMetadata.field, fieldMetadata.label, value, {
    type: fieldMetadata.control === "number" ? "number" : fieldMetadata.control || "text",
    min: fieldMetadata.min,
    max: fieldMetadata.max,
    step: fieldMetadata.step,
  });
}

function renderFieldsFromMetadata(scope, id, entity, fieldMetadataList) {
  return fieldMetadataList
    .filter((fieldMetadata) => (typeof fieldMetadata.when === "function" ? fieldMetadata.when(entity) : true))
    .map((fieldMetadata) => renderFieldFromMetadata(scope, id, entity, fieldMetadata))
    .join("");
}

function renderCreateFieldsFromMetadata(scope, draft, fieldMetadataList) {
  return fieldMetadataList.map((fieldMetadata) => renderCreateFieldFromMetadata(scope, draft, fieldMetadata)).join("");
}

function renderCreatePanel(scope, title, renderFields, context = {}, options = {}) {
  const isOpen = isEntityCreateFormOpen(scope, context);
  const contextAttribute = context.locationId ? ` data-editor-create-context="${escapeAttribute(context.locationId)}"` : "";
  const actionAttribute = isOpen ? `data-editor-create-entity="${scope}"` : `data-editor-open-create="${scope}"`;
  const actionText = isOpen ? "Сохранить" : "Добавить";
  const cancelButton = isOpen
    ? `<button class="secondary-button compact-button" type="button" data-editor-cancel-create="${scope}"${contextAttribute}>Отмена</button>`
    : "";
  const tag = options.inline ? "div" : "section";
  const openClass = isOpen ? "open" : "closed";
  const className = options.inline ? `editor-create-inline ${openClass}` : `editor-section editor-create-section ${openClass}`;
  const body = isOpen ? `<div class="editor-grid">${renderFields()}</div>` : "";
  return `
    <${tag} class="${className}"${contextAttribute}>
      <div class="editor-section-header">
        <h3>${title}</h3>
        <div class="editor-header-actions">
          <button class="secondary-button compact-button" type="button" ${actionAttribute}${contextAttribute} aria-expanded="${isOpen ? "true" : "false"}">${actionText}</button>
          ${cancelButton}
        </div>
      </div>
      ${body}
    </${tag}>
  `;
}

function renderCreateSection(scope, title, renderFields, context = {}) {
  return renderCreatePanel(scope, title, renderFields, context);
}

function getEntityMetadataContext(overrides = {}) {
  return {
    locations,
    zones,
    statDefs,
    resourceDefs,
    initialResources: runtime.initialResources,
    ...overrides,
  };
}

function renderMetadataCreateSection(scope, title, context = {}, options = {}) {
  return renderCreatePanel(
    scope,
    title,
    () => {
      const draft = getEntityCreateDraft(scope, context);
      return renderCreateFieldsFromMetadata(scope, draft, getCreateFieldMetadataList(scope, getEntityMetadataContext(context)));
    },
    context,
    options
  );
}

function renderDeleteButton(scope, id) {
  return `
    <button class="secondary-button compact-button danger-button" type="button"
      data-editor-delete-entity="${scope}"
      data-editor-delete-id="${escapeAttribute(id)}">
      Удалить
    </button>
  `;
}

function renderBackButton(scope, target = "list", label = "Назад") {
  return `
    <button class="secondary-button compact-button" type="button"
      data-editor-back="${escapeAttribute(scope)}"
      data-editor-back-target="${escapeAttribute(target)}">
      ${label}
    </button>
  `;
}

function renderEntityListItem(scope, item, meta = "") {
  return `
    <button class="editor-list-item" type="button"
      data-editor-select-entity="${escapeAttribute(scope)}"
      data-editor-select-id="${escapeAttribute(item.id)}">
      <strong>${escapeHtml(item.name || item.id)}</strong>
      <span>${escapeHtml(item.id)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </button>
  `;
}

function renderZoneLinkedPaths(zone) {
  const linkedPaths = paths.filter((path) => path.a === zone.id || path.b === zone.id);
  return `
    <section class="editor-section editor-list-section zone-linked-paths">
      <div class="editor-section-header">
        <h3>Связанные пути</h3>
      </div>
      ${
        linkedPaths.length
          ? `<div class="editor-entity-list">
              ${linkedPaths
                .map((path) => {
                  const otherZoneId = path.a === zone.id ? path.b : path.a;
                  const otherZone = getZone(otherZoneId);
                  return `
                    <div class="editor-related-path">
                      ${renderEntityListItem("path", path, `${otherZone?.name || otherZoneId || "Неизвестная зона"} · ${path.type || "путь"}`)}
                      <button class="secondary-button compact-button danger-button" type="button"
                        data-editor-delete-entity="path"
                        data-editor-delete-id="${escapeAttribute(path.id)}"
                        data-editor-delete-keep-zone="${escapeAttribute(zone.id)}">
                        Удалить
                      </button>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : '<p class="editor-note">С этой зоной пока не связано ни одного пути.</p>'
      }
    </section>
  `;
}

function getAdjacentEntity(items, selectedId, step) {
  if (!items.length) return null;
  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId)
  );
  const nextIndex = (currentIndex + step + items.length) % items.length;
  return items[nextIndex];
}

function renderDetailPicker(kind, items, selectedId) {
  return `
    <div class="editor-field entity-picker editor-detail-picker" data-editor-object-picker="${escapeAttribute(kind)}">
      <select data-editor-picker="${escapeAttribute(kind)}">
        ${items
          .map(
            (item) => `<option value="${escapeAttribute(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`
          )
          .join("")}
      </select>
    </div>
  `;
}

function renderEntityStepButton(scope, item, direction, disabled = false) {
  const isPrevious = direction === "previous";
  const title = isPrevious ? "Предыдущая сущность" : "Следующая сущность";
  return `
    <button class="secondary-button compact-button editor-step-button" type="button"
      data-editor-select-entity="${escapeAttribute(scope)}"
      data-editor-select-id="${escapeAttribute(item?.id || "")}"
      data-editor-nav="${escapeAttribute(direction)}"
      title="${title}"
      aria-label="${title}"
      ${disabled ? "disabled" : ""}>
      ${isPrevious ? "‹" : "›"}
    </button>
  `;
}

function renderDetailToolbar({
  scope,
  selectScope,
  pickerKind,
  items,
  selectedId,
  deleteButton = "",
  extraActions = "",
  backTarget = "list",
  backLabel = "К списку",
}) {
  const previousItem = getAdjacentEntity(items, selectedId, -1);
  const nextItem = getAdjacentEntity(items, selectedId, 1);
  const hasMultipleItems = items.length > 1;
  return `
    <section class="editor-section editor-detail-toolbar">
      <div class="editor-detail-navigation">
        ${renderEntityStepButton(selectScope, previousItem, "previous", !hasMultipleItems)}
        ${renderDetailPicker(pickerKind, items, selectedId)}
        ${renderEntityStepButton(selectScope, nextItem, "next", !hasMultipleItems)}
      </div>
      <div class="editor-header-actions">
        ${renderBackButton(scope, backTarget, backLabel)}
        ${extraActions}
        ${deleteButton}
      </div>
    </section>
  `;
}

function renderEntityListSection(scope, title, items, createSection, renderMeta = () => "", emptyText = "Список пуст.") {
  return `
    ${createSection}
    <section class="editor-section editor-list-section">
      <div class="editor-section-header">
        <h3>${title}</h3>
        <span class="editor-list-count">${items.length}</span>
      </div>
      ${
        items.length
          ? `<div class="editor-entity-list">${items.map((item) => renderEntityListItem(scope, item, renderMeta(item))).join("")}</div>`
          : `<p class="editor-note">${emptyText}</p>`
      }
    </section>
  `;
}

function renderAgentCreateSection() {
  return renderCreateSection("agent", "Новый агент", () => {
    const draft = getEntityCreateDraft("agent");
    return renderCreateFieldsFromMetadata("agent", draft, getAgentCreateFieldMetadata({ locations }));
  });
}

function renderZoneCreateSection() {
  return renderCreateSection("zone", "Новая зона", () => {
    const draft = getEntityCreateDraft("zone");
    return renderCreateFieldsFromMetadata("zone", draft, zoneCreateFieldMetadata);
  });
}

function renderPathCreateSection() {
  return renderCreateSection("path", "Новый путь", () => {
    const draft = getEntityCreateDraft("path");
    return renderCreateFieldsFromMetadata("path", draft, getPathCreateFieldMetadata({ zones }));
  });
}

function renderLocationCreateSection() {
  return renderCreateSection("location", "Новая локация", () => {
    const draft = getEntityCreateDraft("location");
    return renderCreateFieldsFromMetadata("location", draft, getLocationCreateFieldMetadata({ zones }));
  });
}

function renderTraitCreateSection() {
  return renderCreateSection("trait", "Новая черта", () => {
    const draft = getEntityCreateDraft("trait");
    return renderCreateFieldsFromMetadata("trait", draft, traitCreateFieldMetadata);
  });
}

function renderActivityCreateSection() {
  return renderCreateSection("activity", "Новая активность", () => {
    const draft = getEntityCreateDraft("activity");
    return renderCreateFieldsFromMetadata("activity", draft, activityCreateFieldMetadata);
  });
}

function renderStatusCreateSection() {
  return renderCreateSection("status", "Новый статусный эффект", () => {
    const draft = getEntityCreateDraft("status");
    return renderCreateFieldsFromMetadata("status", draft, statusCreateFieldMetadata);
  });
}

function renderResourceMapControls({ title, values = {}, getDataset }) {
  return `
    <div class="editor-field wide editor-resource-map">
      <span>${escapeHtml(title)}</span>
      <div class="editor-resource-map-grid">
        ${Object.entries(resourceDefs)
          .map(([resource, def]) => {
            const dataset = getDataset(resource);
            const datasetAttributes = Object.entries(dataset)
              .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
              .join(" ");
            return `
              <label class="editor-resource-map-field">
                <span>${escapeHtml(def.short || def.label || resource)}</span>
                <input type="number" value="${escapeAttribute(values[resource] ?? 0)}" step="1" ${datasetAttributes}>
              </label>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderUpgradeCostEditor(upgrade) {
  return renderResourceMapControls({
    title: "Стоимость",
    values: upgrade.cost || {},
    getDataset: (resource) => ({
      "data-upgrade-cost-upgrade": upgrade.id,
      "data-upgrade-cost-resource": resource,
    }),
  });
}

function renderUpgradeCreateSection() {
  return renderMetadataCreateSection("upgrade", "Новый апгрейд");
}

function renderEventCreateSection() {
  return renderMetadataCreateSection("event", "Новое событие");
}

function renderTaskCreateFields(location) {
  return renderCreatePanel(
    "task",
    "Новая задача",
    () => {
      const draft = getEntityCreateDraft("task", { locationId: location.id });
      return taskCreateFieldMetadata.map((fieldMetadata) => renderCreateFieldFromMetadata("task", draft, fieldMetadata)).join("");
    },
    { locationId: location.id },
    { inline: true }
  );
}

function renderAgentSympathyTraitsEditor(agent) {
  const entries = getSympathyTraitEntries(agent, { includeEmpty: true });
  const agentId = escapeAttribute(agent.id);
  const currentSection = getSympathySectionInfo(agent.sympathy).section;
  const scaleSections = getSympathyScaleSections();
  const rows = entries.length
    ? entries
        .map((entry, index) => {
          const isActive = currentSection >= entry.section;
          const sectionInfo = scaleSections.find((section) => section.section === entry.section) || getSympathySectionInfo(agent.sympathy);
          const traitOptions = getTraitOptionEntries([entry.trait]);
          const traitDescription = entry.trait ? getTraitDescription(entry.trait) : "Выберите черту из каталога.";
          return `
            <div class="sympathy-trait-editor-row ${isActive ? "active" : ""}" data-agent-sympathy-trait-row>
              <label class="editor-field sympathy-section-field">
                <span>Секция</span>
                <select
                  data-agent-sympathy-trait-field="section"
                  data-agent-sympathy-trait-agent="${agentId}"
                  data-agent-sympathy-trait-index="${index}">
                  ${renderSympathySectionOptions(entry.section)}
                </select>
                <small>${escapeHtml(sectionInfo.rangeLabel)}</small>
              </label>
              <label class="editor-field sympathy-trait-field">
                <span>Черта</span>
                <select
                  data-agent-sympathy-trait-field="trait"
                  data-agent-sympathy-trait-agent="${agentId}"
                  data-agent-sympathy-trait-index="${index}">
                  ${traitOptions
                    .map(
                      (option) =>
                        `<option value="${escapeAttribute(option.value)}" ${isTraitRefSelected([entry.trait], option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                    )
                    .join("")}
                </select>
                <small class="sympathy-trait-description">${escapeHtml(traitDescription)}</small>
              </label>
              <div class="sympathy-trait-actions">
                <span class="sympathy-trait-state">${isActive ? "Активна" : "Ждёт"}</span>
                <button class="secondary-button compact-button"
                  type="button"
                  data-agent-sympathy-trait-remove="${agentId}"
                  data-agent-sympathy-trait-index="${index}">
                  Удалить
                </button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="editor-note">Добавьте порог симпатии и черту, которая включится автоматически.</p>`;

  return `
    <div class="editor-field wide sympathy-traits-editor">
      <div class="sympathy-traits-header">
        <span>Черты симпатии</span>
        <button class="secondary-button compact-button" type="button" data-agent-sympathy-trait-add="${agentId}">
          + Добавить
        </button>
      </div>
      <div class="sympathy-traits-list">${rows}</div>
    </div>
  `;
}

function renderMainCharacterSelector() {
  const mainCharacterId = runtime.agentBlueprints.find((agent) => agent.isMainCharacter)?.id || "";
  return `
    <section class="editor-section">
      <div class="editor-grid">
        <label class="editor-field wide">
          <span>Главный герой (ГГ)</span>
          <select data-main-character-select>
            <option value="" ${mainCharacterId ? "" : "selected"}>Не выбран</option>
            ${runtime.agentBlueprints
              .map(
                (agent) =>
                  `<option value="${escapeAttribute(agent.id)}" ${agent.id === mainCharacterId ? "selected" : ""}>${escapeHtml(agent.name)}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
    </section>
  `;
}

function renderReadonlyField(label, value) {
  return `
    <label class="editor-field">
      <span>${label}</span>
      <input type="text" value="${escapeAttribute(value ?? "")}" readonly>
    </label>
  `;
}

export function renderAgentEditor() {
  const mainCharacterSelector = renderMainCharacterSelector();
  if (editorState.entityViews.agents !== "edit") {
    return `${mainCharacterSelector}${renderEntityListSection(
      "agent",
      "Агенты",
      runtime.agentBlueprints,
      renderAgentCreateSection(),
      (agent) => agent.role || "Без роли",
      "Агенты пока не созданы."
    )}`;
  }
  const agent = runtime.agentBlueprints.find((item) => item.id === editorState.agentId) || runtime.agentBlueprints[0];
  if (!agent) return renderAgentCreateSection();
  editorState.agentId = agent.id;
  return `
    ${mainCharacterSelector}
    ${renderDetailToolbar({
      scope: "agents",
      selectScope: "agent",
      pickerKind: "agent",
      items: runtime.agentBlueprints,
      selectedId: agent.id,
      deleteButton: renderDeleteButton("agent", agent.id),
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="agent" data-editor-object-id="${escapeAttribute(agent.id)}">
      <h3>Свойства агента</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("agent", agent.id, agent, getAgentEditorFieldMetadata({ locations }))}
        ${renderAgentTraitSelector(agent)}
        ${renderAgentSympathyTraitsEditor(agent)}
      </div>
    </section>
  `;
}

export function renderTraitEditor() {
  if (editorState.entityViews.traits !== "edit") {
    return renderEntityListSection(
      "trait",
      "Черты",
      traitCatalog,
      renderTraitCreateSection(),
      (trait) => {
        const effectCount = Array.isArray(trait.effects) ? trait.effects.length : 0;
        return effectCount ? `${effectCount} эффектов` : "Без эффектов";
      },
      "Черты пока не созданы."
    );
  }
  const trait = traitCatalog.find((item) => item.id === editorState.traitId) || traitCatalog[0];
  if (!trait) return renderTraitCreateSection();
  editorState.traitId = trait.id;
  const pickerItems = traitCatalog;
  return `
    ${renderDetailToolbar({
      scope: "traits",
      selectScope: "trait",
      pickerKind: "trait",
      items: pickerItems,
      selectedId: trait.id,
      deleteButton: renderDeleteButton("trait", trait.id),
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="trait" data-editor-object-id="${escapeAttribute(trait.id)}">
      <h3>Свойства черты</h3>
      <div class="editor-grid">
        ${renderReadonlyField("Stable ID", trait.id)}
        ${renderFieldsFromMetadata("trait", trait.id, trait, traitEditorFieldMetadata)}
        ${renderTraitEffectsEditor(trait)}
      </div>
    </section>
  `;
}

export function renderUpgradeEditor() {
  if (editorState.entityViews.upgrades !== "edit") {
    return renderEntityListSection(
      "upgrade",
      "Апгрейды",
      upgrades,
      renderUpgradeCreateSection(),
      (upgrade) => {
        const effectCount = Array.isArray(upgrade.buyEffects) ? upgrade.buyEffects.length : 0;
        return effectCount ? `${effectCount} эффектов` : "Без эффектов";
      },
      "Апгрейды пока не созданы."
    );
  }
  const upgrade = upgrades.find((item) => item.id === editorState.upgradeId) || upgrades[0];
  if (!upgrade) return renderUpgradeCreateSection();
  editorState.upgradeId = upgrade.id;
  return `
    ${renderDetailToolbar({
      scope: "upgrades",
      selectScope: "upgrade",
      pickerKind: "upgrade",
      items: upgrades,
      selectedId: upgrade.id,
      deleteButton: renderDeleteButton("upgrade", upgrade.id),
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="upgrade" data-editor-object-id="${escapeAttribute(upgrade.id)}">
      <h3>Свойства апгрейда</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("upgrade", upgrade.id, upgrade, getEditorFieldMetadataList("upgrade", getEntityMetadataContext()))}
        ${renderUpgradeCostEditor(upgrade)}
      </div>
      ${renderUpgradeEffectsEditor(upgrade)}
    </section>
  `;
}

export function renderEventEditor() {
  if (editorState.entityViews.events !== "edit") {
    return renderEntityListSection(
      "event",
      "События",
      eventDeck,
      renderEventCreateSection(),
      (event) => {
        const effectCount = Array.isArray(event.effects) ? event.effects.length : 0;
        if (effectCount) return `${effectCount} эффектов`;
        return "Без эффектов";
      },
      "События пока не созданы."
    );
  }
  const event = eventDeck.find((item) => item.id === editorState.eventId) || eventDeck[0];
  if (!event) return renderEventCreateSection();
  editorState.eventId = event.id;
  return `
    ${renderDetailToolbar({
      scope: "events",
      selectScope: "event",
      pickerKind: "event",
      items: eventDeck,
      selectedId: event.id,
      deleteButton: renderDeleteButton("event", event.id),
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="event" data-editor-object-id="${escapeAttribute(event.id)}">
      <h3>Свойства события</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("event", event.id, event, getEditorFieldMetadataList("event", getEntityMetadataContext()))}
      </div>
      ${renderEventEffectsEditor(event)}
    </section>
  `;
}

export function renderActivityEditor() {
  if (editorState.entityViews.activities !== "edit") {
    return renderEntityListSection(
      "activity",
      "Активности",
      activities,
      renderActivityCreateSection(),
      (activity) => `${activity.kind || "solo"} · ${Array.isArray(activity.effects) ? activity.effects.length : 0} эффектов`,
      "Активности пока не созданы."
    );
  }
  const activity = activities.find((item) => item.id === editorState.activityId) || activities[0];
  if (!activity) return renderActivityCreateSection();
  editorState.activityId = activity.id;
  return `
    ${renderDetailToolbar({ scope: "activities", selectScope: "activity", pickerKind: "activity", items: activities, selectedId: activity.id, deleteButton: renderDeleteButton("activity", activity.id) })}
    <section class="editor-section active-editor-object" data-editor-object-scope="activity" data-editor-object-id="${escapeAttribute(activity.id)}">
      <h3>Свойства активности</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("activity", activity.id, activity, getActivityEditorFieldMetadata())}
      </div>
      ${renderActivityEffectsEditor(activity)}
    </section>
  `;
}

export function renderStatusEditor() {
  if (editorState.entityViews.statuses !== "edit") {
    return renderEntityListSection(
      "status",
      "Статусные эффекты",
      statusEffects,
      renderStatusCreateSection(),
      (status) => `${status.duration} дн. · до ${status.maxStacks} стаков`,
      "Статусные эффекты пока не созданы."
    );
  }
  const status = statusEffects.find((item) => item.id === editorState.statusId) || statusEffects[0];
  if (!status) return renderStatusCreateSection();
  editorState.statusId = status.id;
  return `
    ${renderDetailToolbar({ scope: "statuses", selectScope: "status", pickerKind: "status", items: statusEffects, selectedId: status.id, deleteButton: renderDeleteButton("status", status.id) })}
    <section class="editor-section active-editor-object" data-editor-object-scope="status" data-editor-object-id="${escapeAttribute(status.id)}">
      <h3>Свойства статусного эффекта</h3>
      <div class="editor-grid">${renderFieldsFromMetadata("status", status.id, status, statusEditorFieldMetadata)}</div>
      ${renderStatusEffectsEditor(status)}
    </section>
  `;
}

export function renderZoneEditor() {
  if (editorState.entityViews.zones !== "edit") {
    return renderEntityListSection(
      "zone",
      "Зоны",
      zones,
      renderZoneCreateSection(),
      (zone) => zone.code || "Без кода",
      "Зоны пока не созданы."
    );
  }
  const zone = zones.find((item) => item.id === editorState.zoneId) || zones[0];
  if (!zone) return renderZoneCreateSection();
  editorState.zoneId = zone.id;
  const isLabelDragActive = runtime.zoneLabelDragZoneId === zone.id;
  const labelDragButton = `
    <button class="secondary-button compact-button ${isLabelDragActive ? "active" : ""}"
      type="button"
      data-zone-label-drag-mode="${escapeAttribute(zone.id)}"
      aria-pressed="${isLabelDragActive ? "true" : "false"}">
      ${isLabelDragActive ? "Готово: подпись" : "Перетащить подпись"}
    </button>
  `;
  return `
    ${renderDetailToolbar({
      scope: "zones",
      selectScope: "zone",
      pickerKind: "zone",
      items: zones,
      selectedId: zone.id,
      deleteButton: renderDeleteButton("zone", zone.id),
      extraActions: labelDragButton,
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="zone" data-editor-object-id="${escapeAttribute(zone.id)}">
      <h3>Свойства зоны</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("zone", zone.id, zone, zoneEditorFieldMetadata)}
      </div>
    </section>
    ${renderZoneLinkedPaths(zone)}
  `;
}

export function renderPathEditor() {
  if (editorState.entityViews.paths !== "edit") {
    return renderEntityListSection(
      "path",
      "Пути",
      paths,
      renderPathCreateSection(),
      (path) => `${path.a} ↔ ${path.b}`,
      "Пути пока не созданы."
    );
  }
  const edge = paths.find((item) => item.id === editorState.pathId) || paths[0];
  if (!edge) return renderPathCreateSection();
  editorState.pathId = edge.id;
  const endpoints = getPathEndpoints(edge, getZone(edge.a), getZone(edge.b));
  const bend = getPathBend(edge, endpoints);
  const bendEnabled = isPathBendEnabled(edge);
  const editButtonText = runtime.pathEndpointEditMode ? "Готово" : "Править на карте";
  const pathEditButton = `
    <button class="secondary-button compact-button ${runtime.pathEndpointEditMode ? "active" : ""}" type="button" data-path-endpoint-edit-toggle>
      ${editButtonText}
    </button>
  `;
  return `
    ${renderDetailToolbar({
      scope: "paths",
      selectScope: "path",
      pickerKind: "path",
      items: paths,
      selectedId: edge.id,
      deleteButton: renderDeleteButton("path", edge.id),
      extraActions: pathEditButton,
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="path" data-editor-object-id="${escapeAttribute(edge.id)}">
      <h3>Свойства на карте</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("path", edge.id, edge, getPathEditorFieldMetadata({ zones, endpoints, bend, bendEnabled }))}
      </div>
    </section>
    <section class="editor-section active-editor-object" data-editor-object-scope="path" data-editor-object-id="${escapeAttribute(edge.id)}">
      <h3>Игровые свойства</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("path", edge.id, edge, getPathGameplayEditorFieldMetadata({ resourceDefs }))}
      </div>
    </section>
  `;
}

export function renderLocationEditorContent() {
  if (editorState.entityViews.locations === "list") {
    return renderEntityListSection(
      "location",
      "Локации",
      locations,
      renderLocationCreateSection(),
      (location) => {
        const zoneName = getZone(location.zoneId)?.name || location.zoneId || "Без зоны";
        const taskCount = tasks.filter((task) => task.locationId === location.id).length;
        const mechanicCount = Array.isArray(location.mechanics) ? location.mechanics.length : 0;
        return `${zoneName} · задач: ${taskCount} · механик: ${mechanicCount}`;
      },
      "Локации пока не созданы."
    );
  }
  const location = locations.find((item) => item.id === editorState.locationId) || locations[0];
  if (!location) return renderLocationCreateSection();
  editorState.locationId = location.id;
  editorState.taskLocationId = location.id;
  if (editorState.entityViews.locations === "task") return renderLocationTaskDetail(location);
  return `
    ${renderDetailToolbar({
      scope: "locations",
      selectScope: "location",
      pickerKind: "location",
      items: locations,
      selectedId: location.id,
      deleteButton: renderDeleteButton("location", location.id),
    })}
    ${renderLocationTaskList(location)}
    <section class="editor-section active-editor-object" data-editor-object-scope="location" data-editor-object-id="${escapeAttribute(location.id)}">
      <h3>Свойства: ${escapeHtml(location.name)}</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("location", location.id, location, getLocationEditorFieldMetadata({ zones }))}
      </div>
    </section>
    ${renderLocationVisibilityEditor(location)}
    ${renderLocationMechanicsEditor(location)}
  `;
}

export function renderLocationTaskList(location) {
  const locationTasks = tasks.filter((task) => task.locationId === location.id);
  return `
    <section class="editor-section editor-list-section">
      <div class="editor-section-header">
        <h3>Задачи: ${escapeHtml(location.name)}</h3>
      </div>
      ${renderTaskCreateFields(location)}
      ${
        locationTasks.length
          ? `<div class="editor-entity-list">${locationTasks
              .map((task) => renderEntityListItem("task", task, `${task.kind} · ${getTaskDifficultyLabel(task, gameSettings.taskDifficultyLevels)}`))
              .join("")}</div>`
          : '<p class="editor-note">В этой локации нет задач.</p>'
      }
    </section>
  `;
}

export function renderLocationTaskEditor(location) {
  return renderLocationTaskList(location);
}

export function renderLocationTaskDetail(location) {
  const locationTasks = tasks.filter((task) => task.locationId === location.id);
  const selectedTask = tasks.find((task) => task.id === editorState.taskId && task.locationId === location.id) || locationTasks[0];
  editorState.taskId = selectedTask?.id || "";
  if (!selectedTask) {
    editorState.entityViews.locations = "location";
    return renderLocationEditorContent();
  }
  return `
    ${renderDetailToolbar({
      scope: "locations",
      selectScope: "task",
      pickerKind: "task",
      items: locationTasks,
      selectedId: selectedTask.id,
      deleteButton: renderDeleteButton("task", selectedTask.id),
      backTarget: "location",
      backLabel: "К локации",
    })}
    <section class="editor-section active-editor-object" data-editor-object-scope="task" data-editor-object-id="${escapeAttribute(selectedTask.id)}">
      <h3>Свойства задачи</h3>
      ${renderTaskEditorFields(selectedTask)}
    </section>
  `;
}

export function renderTaskEditorFields(task) {
  return `
    <div class="editor-grid">
      ${renderFieldsFromMetadata("task", task.id, task, getTaskEditorFieldMetadata({ locations, statDefs, taskDifficultyLevels: gameSettings.taskDifficultyLevels }))}
    </div>
    ${renderTaskOutcomeEffectsEditor(task)}
  `;
}

export function renderResourceEditor() {
  return `
    <section class="editor-section">
      <h3>Начальные ресурсы</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("resource", "initial", runtime.initialResources, getResourceEditorFieldMetadata(resourceDefs, runtime.initialResources))}
      </div>
    </section>
    <section class="editor-section">
      <h3>Бар: автообслуживание</h3>
      <div class="editor-grid">
        ${renderFieldsFromMetadata("bar", "auto-service", runtime.barSettings, getBarSettingsEditorFieldMetadata(runtime.barSettings))}
      </div>
    </section>
  `;
}
