import { TAG_CATEGORY, TAG_DEFINITIONS, createComponentProfile, deleteComponentProfile, getActiveComponentProfileId, getComponentProfiles, getIngredients, overwriteComponentProfile, setActiveComponentProfile, setIngredients, tagSupportsDegree } from "./cocktail-data.js";
import { renderProfileBar } from "../editor-profile-bar.js";

const typeLabels = { plasma: "Плазма", erythrocytes: "Эритроциты", film: "Плёнка", additive: "Добавка" };
const componentTypes = ["plasma", "erythrocytes", "film", "additive"];
const groupLabels = { ...typeLabels, additive: "Добавки" };
const editableTagCategories = [TAG_CATEGORY.flavor, TAG_CATEGORY.bloodGroup, TAG_CATEGORY.benefit];
const history = { past: [], future: [] };
const collapsedGroups = new Set();
const cloneIngredients = () => getIngredients().map((ingredient) => ({ ...ingredient, tags: ingredient.tags.map((tag) => ({ ...tag })) }));

function saveHistory() { history.past.push(cloneIngredients()); history.future = []; }
function undo() { const previous = history.past.pop(); if (!previous) return; history.future.push(cloneIngredients()); setIngredients(previous); }
function redo() { const next = history.future.pop(); if (!next) return; history.past.push(cloneIngredients()); setIngredients(next); }
function escape(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function tagControls(ingredient) {
  return editableTagCategories.map((category) => {
    const tags = Object.values(TAG_DEFINITIONS).filter((tag) => tag.category === category).map((tag) => {
      const ingredientTag = ingredient.tags.find((entry) => entry.id === tag.id);
      const degree = ingredientTag?.degree || 1;
      const degreeSelect = ingredientTag && tagSupportsDegree(tag.id) ? `<select aria-label="Степень тега ${tag.label}" data-component-tag-degree="${tag.id}"><option value="1" ${degree === 1 ? "selected" : ""}>1</option><option value="2" ${degree === 2 ? "selected" : ""}>2</option><option value="3" ${degree === 3 ? "selected" : ""}>3</option></select>` : "";
      return `<label class="nighttime-component-tag cocktail-tag tag-${tag.category}"><input type="checkbox" data-component-tag="${tag.id}" ${ingredientTag ? "checked" : ""}><span>${tag.label}</span>${degreeSelect}</label>`;
    }).join("");
    return `<section class="nighttime-editor-tag-category"><div class="nighttime-component-tags">${tags}</div></section>`;
  }).join("");
}

export function renderComponentEditorProfileBar() {
  const profiles = getComponentProfiles();
  const activeProfileId = getActiveComponentProfileId();
  return renderProfileBar({ profiles, activeProfileId, historyState: { canUndo: history.past.length > 0, canRedo: history.future.length > 0 }, prefix: "component", statusLabel: "Сохранено в браузере", statusSource: "Компоненты" });
}

export function renderComponentEditor() {
  const ingredients = getIngredients();
  return `
    <section class="editor-section nighttime-component-editor">
      <div class="nighttime-component-list">
        ${componentTypes.map((type) => `
          <section class="nighttime-component-group${collapsedGroups.has(type) ? " collapsed" : ""}" data-component-group="${type}">
            <div class="editor-section-header"><h3>${groupLabels[type]} <span class="editor-list-count">${ingredients.filter((ingredient) => ingredient.type === type).length}</span></h3><div class="panel-heading-actions"><button class="secondary-button compact-button" type="button" data-component-create="${type}">Добавить</button><button class="secondary-button compact-button" type="button" data-component-collapse="${type}">${collapsedGroups.has(type) ? "Развернуть" : "Свернуть"}</button></div></div>
            ${collapsedGroups.has(type) ? "" : ingredients.filter((ingredient) => ingredient.type === type).map((ingredient) => `
              <article class="nighttime-component-card" data-component-id="${escape(ingredient.id)}">
                <div><strong>${escape(ingredient.name)}</strong></div>
                <button class="icon-button" type="button" aria-label="Удалить ${escape(ingredient.name)}" data-component-delete="${escape(ingredient.id)}">×</button>
                <div class="nighttime-component-tags">${tagControls(ingredient)}</div>
              </article>`).join("") || '<p class="muted">Нет компонентов.</p>'}
          </section>`).join("")}
      </div>
    </section>`;
}

function createIngredient(type) {
  const name = window.prompt("Название компонента");
  if (!name?.trim()) return;
  if (!typeLabels[type]) return;
  const id = `custom-${Date.now()}`;
  saveHistory(); setIngredients([...getIngredients(), { id, name: name.trim(), type, tags: [] }]);
}

export function bindComponentEditorEvents(root = document) {
  const bindingTarget = root.documentElement || root;
  if (bindingTarget.dataset.componentEditorBound) return;
  bindingTarget.dataset.componentEditorBound = "true";
  root.addEventListener("click", (event) => {
    const historyAction = event.target.closest("[data-component-history-action]")?.dataset.componentHistoryAction;
    if (historyAction === "undo") { undo(); return; }
    if (historyAction === "redo") { redo(); return; }
    const profileAction = event.target.closest("[data-component-profile-action]");
    if (profileAction) { handleProfileAction(profileAction); return; }
    const collapse = event.target.closest("[data-component-collapse]");
    if (collapse) { const type = collapse.dataset.componentCollapse; collapsedGroups.has(type) ? collapsedGroups.delete(type) : collapsedGroups.add(type); setIngredients(getIngredients()); return; }
    const create = event.target.closest("[data-component-create]");
    if (create) { createIngredient(create.dataset.componentCreate); return; }
    const remove = event.target.closest("[data-component-delete]");
    if (remove) { saveHistory(); setIngredients(getIngredients().filter((ingredient) => ingredient.id !== remove.dataset.componentDelete)); }
  });
  root.addEventListener("change", (event) => {
    const profileSelect = event.target.closest("[data-component-profile-select]");
    if (profileSelect) {
      history.past = []; history.future = [];
      setActiveComponentProfile(profileSelect.value);
      return;
    }
    const degreeSelect = event.target.closest("[data-component-tag-degree]");
    if (degreeSelect) {
      const card = degreeSelect.closest("[data-component-id]");
      saveHistory();
      setIngredients(getIngredients().map((ingredient) => ingredient.id !== card?.dataset.componentId ? ingredient : { ...ingredient, tags: ingredient.tags.map((tag) => tag.id === degreeSelect.dataset.componentTagDegree ? { ...tag, degree: Number(degreeSelect.value) || 1 } : tag) }));
      return;
    }
    const input = event.target.closest("[data-component-tag]");
    if (!input) return;
    const card = input.closest("[data-component-id]");
    const ingredients = getIngredients().map((ingredient) => {
      if (ingredient.id !== card?.dataset.componentId) return ingredient;
      const tags = ingredient.tags.filter((tag) => tag.id !== input.dataset.componentTag);
      if (input.checked) tags.push({ id: input.dataset.componentTag, degree: 1 });
      return { ...ingredient, tags };
    });
    saveHistory(); setIngredients(ingredients);
  });
}

function handleProfileAction(button) {
  const action = button.dataset.componentProfileAction;
  if (action === "create" || action === "duplicate") {
    const active = getComponentProfiles().find((profile) => profile.id === getActiveComponentProfileId());
    const name = window.prompt(action === "create" ? "Название нового профиля" : "Название копии профиля", action === "create" ? "Новый профиль" : `${active?.name || "Профиль"} копия`);
    if (name?.trim()) { history.past = []; history.future = []; createComponentProfile(name); }
    return;
  }
  if (action === "show-overwrite") { button.closest(".editor-profile-popover")?.querySelector("[data-component-profile-overwrite-panel]")?.removeAttribute("hidden"); return; }
  if (action === "cancel-overwrite") { button.closest(".editor-profile-popover")?.querySelector("[data-component-profile-overwrite-panel]")?.setAttribute("hidden", ""); return; }
  if (action === "overwrite") {
    const target = button.closest(".editor-profile-popover")?.querySelector("[data-component-profile-overwrite-target]")?.value;
    if (target && window.confirm("Перезаписать выбранный профиль текущими компонентами?")) { history.past = []; history.future = []; overwriteComponentProfile(target); }
    return;
  }
  if (action === "delete") {
    const active = getComponentProfiles().find((profile) => profile.id === getActiveComponentProfileId());
    if (active && window.confirm(`Удалить профиль «${active.name}»?`)) { history.past = []; history.future = []; deleteComponentProfile(active.id); }
  }
}
