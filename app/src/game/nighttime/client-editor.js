import { TAG_CATEGORY, TAG_DEFINITIONS, tagSupportsDegree } from "./cocktail-data.js";
import { PREFERENCE_ATTITUDE, PREFERENCE_ATTITUDE_LABEL, createClient, getClients, setClients } from "./client-preferences.js";

const groups = [[PREFERENCE_ATTITUDE.like, PREFERENCE_ATTITUDE_LABEL[1]], [PREFERENCE_ATTITUDE.stronglyLike, PREFERENCE_ATTITUDE_LABEL[2]], [PREFERENCE_ATTITUDE.dislike, PREFERENCE_ATTITUDE_LABEL[-1]], [PREFERENCE_ATTITUDE.stronglyDislike, PREFERENCE_ATTITUDE_LABEL[-2]]];
const tagCategories = [TAG_CATEGORY.flavor, TAG_CATEGORY.bloodGroup, TAG_CATEGORY.benefit, TAG_CATEGORY.composition, TAG_CATEGORY.serving];

function escape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function adjacentClient(clients, selectedId, offset) {
  const index = Math.max(0, clients.findIndex((client) => client.id === selectedId));
  return clients[(index + offset + clients.length) % clients.length];
}

function renderClientList(clients) {
  return `<section class="editor-section editor-list-section nighttime-client-list-section"><div class="editor-section-header"><h3>Клиенты</h3><div class="panel-heading-actions"><span class="editor-list-count">${clients.length}</span><button class="secondary-button compact-button" type="button" data-client-create>Добавить</button></div></div>${clients.length ? `<div class="editor-entity-list nighttime-client-list">${clients.map((client) => `<button class="editor-list-item" type="button" data-client-open="${escape(client.id)}"><strong>${escape(client.name)}</strong><span>${escape(client.id)}</span><small>${client.preferences.length} предпочтений</small></button>`).join("")}</div>` : '<p class="editor-note">Список клиентов пуст.</p>'}</section>`;
}

function renderClientTag(client, attitude, tag) {
  const preference = client.preferences.find((item) => item.tagId === tag.id && item.attitude === attitude);
  const degree = Math.max(1, Math.trunc(Number(preference?.degree) || 1));
  const degreeControl = preference && tagSupportsDegree(tag.id) ? `<input type="number" min="1" step="1" aria-label="Степень тега ${escape(tag.label)}" value="${degree}" data-client-degree="${escape(tag.id)}" data-client-attitude="${attitude}">` : "";
  return `<label class="nighttime-component-tag cocktail-tag tag-${tag.category}"><input type="checkbox" data-client-tag="${escape(tag.id)}" data-client-attitude="${attitude}" ${preference ? "checked" : ""}><span>${escape(tag.label)}</span>${degreeControl}</label>`;
}

function renderClientDetail(clients, client) {
  const canNavigate = clients.length > 1;
  const previous = adjacentClient(clients, client.id, -1);
  const next = adjacentClient(clients, client.id, 1);
  return `<section class="editor-section editor-detail-toolbar nighttime-client-toolbar"><div class="editor-detail-navigation"><button class="secondary-button compact-button editor-step-button" type="button" data-client-select="${escape(previous?.id)}" aria-label="Предыдущий клиент" ${canNavigate ? "" : "disabled"}>‹</button><div class="editor-field editor-detail-picker"><select aria-label="Текущий клиент" data-client-picker>${clients.map((item) => `<option value="${escape(item.id)}" ${item.id === client.id ? "selected" : ""}>${escape(item.name || item.id)}</option>`).join("")}</select></div><button class="secondary-button compact-button editor-step-button" type="button" data-client-select="${escape(next?.id)}" aria-label="Следующий клиент" ${canNavigate ? "" : "disabled"}>›</button></div><div class="editor-header-actions"><button class="secondary-button compact-button" type="button" data-client-back>← Список</button><button class="secondary-button compact-button danger-button" type="button" data-client-delete>Удалить</button></div></section><section class="editor-section nighttime-client-editor-section"><article class="nighttime-client-form" data-client-id="${escape(client.id)}"><div class="nighttime-client-fields"><label>Имя<input data-client-name value="${escape(client.name)}"></label><label>ID<input data-client-id-field value="${escape(client.id)}"></label></div><div class="nighttime-client-groups">${groups.map(([attitude, label]) => `<section class="nighttime-client-group"><h3>${escape(label)}</h3>${tagCategories.map((category) => `<section class="nighttime-editor-tag-category"><div class="nighttime-component-tags">${Object.values(TAG_DEFINITIONS).filter((tag) => tag.category === category).map((tag) => renderClientTag(client, attitude, tag)).join("")}</div></section>`).join("")}</section>`).join("")}</div></article></section>`;
}

export function renderClientEditor(selectedId = "") {
  const clients = getClients();
  if (!selectedId) return renderClientList(clients);
  const client = clients.find((item) => item.id === selectedId);
  return client ? renderClientDetail(clients, client) : renderClientList(clients);
}

export function bindClientEditor(root = document) {
  const bindingTarget = root.documentElement || root;
  if (bindingTarget.dataset.clientEditorBound) return;
  bindingTarget.dataset.clientEditorBound = "true";
  root.addEventListener("click", (event) => { if (event.target.closest("[data-client-create]")) createClient(); });
  root.addEventListener("change", (event) => {
    const card = event.target.closest("[data-client-id]");
    if (!card) return;
    setClients(getClients().map((client) => {
      if (client.id !== card.dataset.clientId) return client;
      const id = card.querySelector("[data-client-id-field]").value.trim();
      const name = card.querySelector("[data-client-name]").value.trim();
      const preferences = [...card.querySelectorAll("[data-client-tag]:checked")].map((input) => ({ tagId: input.dataset.clientTag, attitude: Number(input.dataset.clientAttitude), degree: Number(card.querySelector(`[data-client-degree="${input.dataset.clientTag}"][data-client-attitude="${input.dataset.clientAttitude}"]`)?.value) || 1 }));
      return { id, name, preferences };
    }));
  });
}
