import { locations, statusEffects } from "./data.js";
import { changeLocationShopStock, getLocationMechanicValue, getLocationShops, getLocationShopOfferState, LOCATION_MECHANIC_TYPES, normalizeLocationScale } from "./location-mechanics.js";
import { changeLocationMechanicValueWithEffects } from "./location-mechanic-effects-runtime.js";
import { normalizeLocationCounter } from "./location-counters.js";
import { RESOURCE_DEFINITIONS, STANDARD_RESOURCE_IDS } from "./resource-catalog.js";
import { state } from "./state.js";
import { grantAgentStatus } from "./status-effects-runtime.js";
import { getTraitOptionEntries } from "./trait-catalog.js";
import { registerDebugPanelController } from "./debug-panel.js";
import { render } from "./render-core.js";

function escape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function selectOptions(items, selectedId, getId, getLabel) {
  return items.map((item) => `<option value="${escape(getId(item))}" ${getId(item) === selectedId ? "selected" : ""}>${escape(getLabel(item))}</option>`).join("");
}

function getLocationMechanicOptions() {
  return locations.flatMap((location) => {
    const valueMechanics = (location.mechanics || []).flatMap((mechanic, index) => {
      if (mechanic?.type === LOCATION_MECHANIC_TYPES.counter) {
        const counter = normalizeLocationCounter(mechanic);
        return [{
          id: `${location.id}:counter:${index}`,
          location,
          type: LOCATION_MECHANIC_TYPES.counter,
          index,
          mechanic,
          label: `${location.name}: ${counter.name}`,
          value: getLocationMechanicValue(state, location.id, LOCATION_MECHANIC_TYPES.counter, counter.id, counter.value),
        }];
      }
      if (mechanic?.type === LOCATION_MECHANIC_TYPES.scale) {
        const scale = normalizeLocationScale(mechanic);
        return [{
          id: `${location.id}:scale:${index}`,
          location,
          type: LOCATION_MECHANIC_TYPES.scale,
          index,
          mechanic,
          label: `${location.name}: ${scale.name}`,
          value: getLocationMechanicValue(state, location.id, LOCATION_MECHANIC_TYPES.scale, scale.id, scale.value),
        }];
      }
      return [];
    });
    const shopOffers = getLocationShops(location).flatMap((shop, shopIndex) =>
      shop.sellOffers.map((offer, offerIndex) => {
        const offerState = getLocationShopOfferState(state, location.id, shop.id, offer.id, offer);
        return {
          id: `${location.id}:shop:${shopIndex}:${offerIndex}`,
          location,
          kind: "shop",
          shopIndex,
          offerIndex,
          shopId: shop.id,
          offerId: offer.id,
          offer,
          label: `${location.name}: ${shop.name} - ${RESOURCE_DEFINITIONS[offer.resource]?.label || offer.resource}`,
          value: offerState.stock,
        };
      })
    );
    return [...valueMechanics, ...shopOffers];
  });
}

function renderDaytimeCheats() {
  const agents = state.agents || [];
  const mechanics = getLocationMechanicOptions();
  const traitOptions = getTraitOptionEntries();
  const firstAgent = agents[0]?.id || "";
  const firstResource = STANDARD_RESOURCE_IDS[0];
  return `
    <div class="debug-panel-heading"><strong>Тестовая сессия</strong><button class="icon-button" type="button" data-debug-close aria-label="Закрыть чит-панель">×</button></div>
    <section class="debug-cheat-section">
      <h3>Ресурсы</h3>
      <div class="debug-cheat-row">
        <select data-debug-resource>${STANDARD_RESOURCE_IDS.map((id) => `<option value="${id}" ${id === firstResource ? "selected" : ""}>${escape(RESOURCE_DEFINITIONS[id].label)}</option>`).join("")}</select>
        <input type="number" min="1" value="5" data-debug-resource-amount aria-label="Количество ресурса">
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="resource-add">Добавить</button>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="resource-set">Установить</button>
      </div>
    </section>
    <section class="debug-cheat-section">
      <h3>Агент</h3>
      <div class="debug-cheat-row">
        <select data-debug-agent>${selectOptions(agents, firstAgent, (agent) => agent.id, (agent) => agent.name)}</select>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-restore">Восстановить энергию</button>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-clear-fatigue">Снять усталость</button>
      </div>
      <div class="debug-cheat-row">
        <select class="debug-trait-select" data-debug-trait ${traitOptions.length ? "" : "disabled"}>${traitOptions.length ? selectOptions(traitOptions, "", (trait) => trait.value, (trait) => trait.label) : '<option value="">Нет доступных черт</option>'}</select>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-add-trait">Добавить черту</button>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-clear-traits">Снять черты</button>
      </div>
      <div class="debug-cheat-row">
        <select data-debug-status>${selectOptions(statusEffects, "", (status) => status.id, (status) => status.name || status.id)}</select>
        <input type="number" min="1" value="1" data-debug-status-stacks aria-label="Стаки статуса">
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-add-status">Наложить статус</button>
        <button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="agent-clear-statuses">Снять статусы</button>
      </div>
    </section>
    <section class="debug-cheat-section">
      <h3>Механики локаций</h3>
      ${mechanics.length
        ? `<div class="debug-cheat-row"><select data-debug-mechanic>${selectOptions(mechanics, mechanics[0]?.id, (mechanic) => mechanic.id, (mechanic) => mechanic.label)}</select><input type="number" value="${mechanics[0]?.value ?? 0}" data-debug-mechanic-value aria-label="Значение механики"><button class="secondary-button compact-button" type="button" data-debug-controller="daytime" data-debug-action="mechanic-set">Установить</button></div>`
        : '<p class="debug-panel-note">На локациях пока нет счётчиков или шкал.</p>'}
    </section>
    <p class="debug-panel-note">Изменения действуют только до перезапуска текущей игры и не сохраняются в профиль.</p>
  `;
}

function getSelectedAgent(content) {
  return state.agents.find((agent) => agent.id === content.querySelector("[data-debug-agent]")?.value) || null;
}

function handleDaytimeCheat(action, content) {
  const type = action.dataset.debugAction;
  if (type === "resource-add" || type === "resource-set") {
    const resourceId = content.querySelector("[data-debug-resource]")?.value;
    const amount = Math.max(0, Math.trunc(Number(content.querySelector("[data-debug-resource-amount]")?.value) || 0));
    if (!STANDARD_RESOURCE_IDS.includes(resourceId)) return false;
    state.resources[resourceId] = type === "resource-add" ? (Number(state.resources[resourceId]) || 0) + amount : amount;
  } else if (type === "agent-restore") {
    const agent = getSelectedAgent(content);
    if (!agent) return false;
    agent.energy = Number(agent.maxEnergy) || agent.energy;
    agent.overtimeLeft = Number(agent.overtimeMax) || agent.overtimeLeft;
  } else if (type === "agent-clear-fatigue") {
    const agent = getSelectedAgent(content);
    if (!agent) return false;
    agent.fatigue = 0;
  } else if (type === "agent-add-trait") {
    const agent = getSelectedAgent(content);
    const traitId = String(content.querySelector("[data-debug-trait]")?.value || "").trim();
    if (!agent || !traitId) return false;
    agent.traits = [...new Set([...(agent.traits || []), traitId])];
  } else if (type === "agent-clear-traits") {
    const agent = getSelectedAgent(content);
    if (!agent) return false;
    agent.traits = [];
  } else if (type === "agent-add-status") {
    const agent = getSelectedAgent(content);
    const statusId = content.querySelector("[data-debug-status]")?.value;
    const stacks = content.querySelector("[data-debug-status-stacks]")?.value;
    if (!agent || !grantAgentStatus(agent, statusId, stacks)) return false;
  } else if (type === "agent-clear-statuses") {
    const agent = getSelectedAgent(content);
    if (!agent) return false;
    agent.statuses = [];
  } else if (type === "mechanic-set") {
    const selectedId = content.querySelector("[data-debug-mechanic]")?.value;
    const targetValue = Math.trunc(Number(content.querySelector("[data-debug-mechanic-value]")?.value));
    const mechanic = getLocationMechanicOptions().find((item) => item.id === selectedId);
    if (!mechanic || !Number.isFinite(targetValue)) return false;
    if (mechanic.kind === "shop") {
      changeLocationShopStock(state, mechanic.location.id, mechanic.shopId, mechanic.offerId, mechanic.offer, targetValue - mechanic.value);
    } else {
      const current = getLocationMechanicValue(state, mechanic.location.id, mechanic.type, mechanic.mechanic.id, mechanic.value);
      changeLocationMechanicValueWithEffects(state, mechanic.location.id, mechanic.mechanic.id, targetValue - current);
    }
  } else {
    return false;
  }
  render();
  return true;
}

export function registerDaytimeDebugCheats() {
  registerDebugPanelController({ id: "daytime", label: "День", render: renderDaytimeCheats, handleAction: handleDaytimeCheat });
}
