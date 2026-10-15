import { resourceDefs, runtime, state } from "./state.js";
import { RESOURCE_CATEGORY_DEFINITIONS } from "./resource-catalog.js";
import { dom } from "./dom.js";
import { escapeAttribute, escapeHtml, formatDayLabel, formatResource, getAvailableOvertime, getBossShare, getNextWorkingDay, getOrderDemand, getRecovery, getRecoveryBreakdown, getSelectedAgent } from "./rules.js";
import { FATIGUE_MAX } from "./agent-parameters.js";
import { isAgentSympathyEnabled } from "./agent-main-character.js";
import { formatSignedNumber, getActiveAgentTraits, getSympathyScaleSections, getSympathySectionInfo } from "./agent-traits.js";
import { getAgentEffectiveFatigue, getAgentEffectiveSympathy, getAgentMaxEnergy, getAgentOvertimeMax } from "./trait-effects-runtime.js";
import { getAgentStatuses } from "./status-effects-runtime.js";
import { getAutoServicePreview } from "./bar-auto-service.js";
import { getTraitDescription } from "./trait-catalog.js";

export function syncInventoryPanelBounds() {
  const cityRect = dom.cityArea?.getBoundingClientRect();
  const dockRect = dom.agentDock?.getBoundingClientRect();
  if (!cityRect || !dockRect) return;

  const dockIsInsideCityArea = dockRect.top < cityRect.bottom && dockRect.bottom > cityRect.top;
  const bottomOffset = dockIsInsideCityArea ? Math.max(18, Math.ceil(cityRect.bottom - dockRect.top + 12)) : 18;
  dom.cityArea.style.setProperty("--inventory-panel-bottom", `${bottomOffset}px`);
}

export function renderTopBar() {
  const sidePanelOpen = runtime.inventoryPanelOpen || runtime.journalPanelOpen || runtime.upgradePanelOpen || runtime.barPanelOpen;
  dom.dayCounter.textContent = formatDayLabel();
  dom.cityArea.classList.toggle("side-panel-open", sidePanelOpen);
  dom.inventoryPanel.classList.toggle("open", runtime.inventoryPanelOpen);
  dom.inventoryPanel.setAttribute("aria-hidden", String(!runtime.inventoryPanelOpen));
  dom.inventoryPanel.inert = !runtime.inventoryPanelOpen;
  dom.inventoryToggleButton.classList.toggle("open", runtime.inventoryPanelOpen);
  dom.inventoryToggleButton.setAttribute("aria-expanded", String(runtime.inventoryPanelOpen));
  dom.journalPanel.classList.toggle("open", runtime.journalPanelOpen);
  dom.journalPanel.setAttribute("aria-hidden", String(!runtime.journalPanelOpen));
  dom.journalPanel.inert = !runtime.journalPanelOpen;
  dom.journalToggleButton.classList.toggle("open", runtime.journalPanelOpen);
  dom.journalToggleButton.setAttribute("aria-expanded", String(runtime.journalPanelOpen));
  dom.upgradePanel.classList.toggle("open", runtime.upgradePanelOpen);
  dom.upgradePanel.setAttribute("aria-hidden", String(!runtime.upgradePanelOpen));
  dom.upgradePanel.inert = !runtime.upgradePanelOpen;
  dom.upgradeToggleButton.classList.toggle("open", runtime.upgradePanelOpen);
  dom.upgradeToggleButton.setAttribute("aria-expanded", String(runtime.upgradePanelOpen));
  dom.barPanel.classList.toggle("open", runtime.barPanelOpen);
  dom.barPanel.setAttribute("aria-hidden", String(!runtime.barPanelOpen));
  dom.barPanel.inert = !runtime.barPanelOpen;
  dom.barToggleButton.classList.toggle("open", runtime.barPanelOpen);
  dom.barToggleButton.setAttribute("aria-expanded", String(runtime.barPanelOpen));

  const hudResources = Object.entries(resourceDefs).map(([key, resource]) => ({
    key,
    label: resource.label,
    value: formatResource(key, state.resources[key]),
    color: resource.color,
    short: resource.short,
  }));

  dom.resourceStrip.innerHTML = RESOURCE_CATEGORY_DEFINITIONS.map((category) => {
    const categoryResources = hudResources.filter((resource) => resourceDefs[resource.key].category === category.id);
    if (!categoryResources.length) return "";
    return `
      <section class="inventory-resource-category" aria-label="${escapeAttribute(category.label)}">
        <h4>${escapeHtml(category.label)}</h4>
        <div class="inventory-resource-category-list">
          ${categoryResources
            .map((resource) => {
      const label = escapeAttribute(resource.label);
      return `
        <div class="resource inventory-resource" tabindex="0" data-tooltip="${label}" aria-label="${label}" data-resource-key="${escapeAttribute(resource.key)}" style="--resource-color: ${resource.color}">
          <span class="resource-icon">${escapeHtml(resource.short)}</span>
          <span class="resource-copy">
            <small>${escapeHtml(resource.label)}</small>
            <strong>${escapeHtml(resource.value)}</strong>
          </span>
        </div>
      `;
            })
            .join("")}
        </div>
      </section>
    `;
  }).join("");

  dom.barStatus.textContent = "Идёт кампания";
  renderBarPanel();
}

function formatAutoServiceBreakdown(result) {
  if (!result.byTier.length) return "Недостаточно крови для продажи.";
  return result.byTier.map((tier) => `${tier.drinks} из ${tier.label}`).join(", ");
}

function renderBarPanel() {
  const preview = getAutoServicePreview();
  const lastRun = state.autoServiceLastRun || { drinks: 0, money: 0, byTier: [] };
  const settings = state.barSettings;
  dom.barPanelContent.innerHTML = `
    <section class="bar-service-card">
      <div class="inventory-section-heading">
        <h3>Автообслуживание</h3>
        <span>${settings.autoServiceLimit} / день</span>
      </div>
      <dl class="bar-service-stats">
        <div><dt>На напиток</dt><dd>${settings.bloodPerDrink} крови</dd></div>
        <div><dt>Следующая продажа</dt><dd>${preview.drinks} напитк. · +${preview.money}$</dd></div>
        <div><dt>Состав</dt><dd>${escapeHtml(formatAutoServiceBreakdown(preview))}</dd></div>
      </dl>
    </section>
    <section class="bar-service-card subdued">
      <div class="inventory-section-heading"><h3>Последняя смена</h3><span>${lastRun.drinks ? `+${lastRun.money}$` : "ещё не было"}</span></div>
      <p>${lastRun.drinks ? `${lastRun.drinks} напитк.: ${escapeHtml(formatAutoServiceBreakdown(lastRun))}.` : "Автообслуживание сработает при переходе к следующему дню."}</p>
    </section>
    <section class="bar-price-list" aria-label="Цены автообслуживания">
      <div><span>Напиток Т3</span><strong>${settings.priceTier3}$</strong></div>
      <div><span>Напиток Т2</span><strong>${settings.priceTier2}$</strong></div>
      <div><span>Напиток Т1</span><strong>${settings.priceTier1}$</strong></div>
    </section>
  `;
}

function getSympathyMarkerPercent(value) {
  const sections = getSympathyScaleSections();
  const firstValue = sections[0].displayLower;
  const lastValue = sections[sections.length - 1].displayUpper;
  const numericValue = Math.trunc(Number(value));
  const clampedValue = Math.min(lastValue, Math.max(firstValue, Number.isFinite(numericValue) ? numericValue : 0));
  if (lastValue === firstValue) return 50;
  return ((clampedValue - firstValue) / (lastValue - firstValue)) * 100;
}

function renderAgentSympathyScale(agent) {
  if (!isAgentSympathyEnabled(agent)) return "";
  const sections = getSympathyScaleSections();
  const effectiveSympathy = getAgentEffectiveSympathy(agent);
  const baseSympathy = Math.trunc(Number(agent.sympathy) || 0);
  const sectionInfo = getSympathySectionInfo(effectiveSympathy);
  const markerPercent = getSympathyMarkerPercent(effectiveSympathy);
  const sympathyLabel =
    effectiveSympathy === baseSympathy ? String(baseSympathy) : `${baseSympathy} (${formatSignedNumber(effectiveSympathy - baseSympathy)})`;
  const tooltip = escapeAttribute(
    `Симпатия ${effectiveSympathy}: ${formatSignedNumber(sectionInfo.mod)} к восстановлению`
  );

  return `
    <span class="agent-sympathy" data-tooltip="${tooltip}">
      <span class="agent-sympathy-header">
        <span>Симпатия</span>
        <strong>${escapeHtml(sympathyLabel)}</strong>
      </span>
      <span class="agent-sympathy-track" aria-label="${tooltip}">
        ${sections
          .map(
            (section) => `
              <span class="agent-sympathy-segment ${section.section === 0 ? "zero" : ""} ${section.section === sectionInfo.section ? "active" : ""}">
                ${section.label}
              </span>
            `
          )
          .join("")}
        <span class="agent-sympathy-marker" style="left: ${markerPercent}%"></span>
      </span>
    </span>
  `;
}

function getStatusIcon(status) {
  if (status.effects.some((effect) => effect.type === "check_advantage" || effect.type === "temporary_check_advantage")) return "+";
  if (status.effects.some((effect) => effect.type === "check_penalty" || effect.type === "temporary_check_penalty")) return "!";
  const recovery = status.effects.find((effect) => effect.type === "agent_parameter_delta" && effect.parameter === "recovery");
  if (recovery) return Number(recovery.amount) >= 0 ? "+" : "-";
  return "*";
}

function renderAgentStatusIcons(agent) {
  return getAgentStatuses(agent)
    .map((entry) => {
      const stackText = entry.stacks > 1 ? `, стаков: ${entry.stacks}` : "";
      const tooltip = escapeAttribute(`${entry.status.name}: ${entry.status.description}${stackText}, осталось дней: ${entry.remainingDays}`);
      const stackBadge = entry.stacks > 1 ? `<span class="agent-status-stack" aria-hidden="true">${entry.stacks}</span>` : "";
      return `<span class="agent-status-icon" data-tooltip="${tooltip}" aria-label="${tooltip}">${getStatusIcon(entry)}${stackBadge}</span>`;
    })
    .join("");
}

function renderAgentTraits(agent) {
  const traits = getActiveAgentTraits(agent);
  if (!traits.length) return "";

  return `
    <span class="agent-card-traits" aria-label="Черты агента">
      <span class="agent-card-trait-list">
        ${traits
          .map((trait) => {
            const tooltip = escapeAttribute(`${trait.name}: ${getTraitDescription(trait.id)}`);
            return `<span class="trait agent-card-trait" data-tooltip="${tooltip}" aria-label="${tooltip}">${escapeHtml(trait.name)}</span>`;
          })
          .join("")}
      </span>
    </span>
  `;
}

export function renderAgents() {
  const totalEnergy = state.agents.reduce((sum, agent) => sum + agent.energy, 0);
  const totalOvertime = state.agents.reduce((sum, agent) => sum + getAvailableOvertime(agent), 0);
  const totalRecovery = state.agents.reduce((sum, agent) => sum + getRecovery(agent), 0);

  dom.agentEnergySummary.innerHTML = `
    <span class="energy-summary-item">
      <small>Энергия:</small>
      <strong>${totalEnergy}</strong>
    </span>
    <span class="energy-summary-item">
      <small>Энергия переработки:</small>
      <strong>${totalOvertime}</strong>
    </span>
    <span class="energy-summary-item">
      <small>Восстановление энергии:</small>
      <strong>${formatSignedNumber(totalRecovery)}</strong>
    </span>
  `;

  dom.agentList.innerHTML = state.agents
    .map((agent) => {
      const recovery = getRecovery(agent);
      const recoveryBreakdown = escapeAttribute(getRecoveryBreakdown(agent));
      const fatigue = getAgentEffectiveFatigue(agent);
      const maxEnergy = getAgentMaxEnergy(agent);
      const overtimeMax = getAgentOvertimeMax(agent);
      const totalCapacity = Math.max(1, maxEnergy + overtimeMax);
      const availableOvertime = getAvailableOvertime(agent);
      const energyPercent = Math.min(100, (agent.energy / totalCapacity) * 100);
      const overtimePercent = Math.min(100, (availableOvertime / totalCapacity) * 100);
      const overtimeLabel = availableOvertime > 0 ? `${availableOvertime}` : "0";
      const segmentState = `${availableOvertime > 0 ? "has-overtime" : ""} ${agent.energy > 0 ? "has-energy" : ""}`;

      return `
        <article class="agent-card ${agent.id === state.selectedAgentId ? "selected" : ""}"
          data-agent-id="${agent.id}"
          style="--portrait: ${agent.color}">
          <button class="agent-select" type="button" data-agent-select="${agent.id}">
            <span class="agent-topline">
              <span class="agent-portrait">${agent.portrait}</span>
              <span class="agent-title">
                <span class="agent-name-row"><span class="agent-name">${agent.name}</span><span class="agent-status-icons">${renderAgentStatusIcons(agent)}</span></span>
                <span class="agent-role">${agent.role}</span>
              </span>
            </span>
            <span class="energy-track ${segmentState}" aria-label="${agent.energy} из ${maxEnergy} энергии, ${availableOvertime} переработки" data-tooltip="${recoveryBreakdown}">
              <span class="overtime-fill" style="left: 0; width: ${overtimePercent}%"></span>
              <span class="energy-fill" style="left: ${overtimePercent}%; width: ${energyPercent}%"></span>
              <span class="energy-label">${agent.energy}/${maxEnergy} · ${formatSignedNumber(recovery)}</span>
              <span class="overtime-label">${overtimeLabel}</span>
            </span>
            <span class="agent-mini-row">
              <span>Усталость</span>
              <strong>${fatigue}/${FATIGUE_MAX}</strong>
            </span>
            ${renderAgentSympathyScale(agent)}
            ${renderAgentTraits(agent)}
          </button>
        </article>
      `;
    })
    .join("");
  syncInventoryPanelBounds();
}

export function renderDaySummary() {
  const eventName = state.event ? state.event.name : "Событий нет";
  const eventDescription = state.event ? state.event.description : "Первый день проходит спокойно.";
  const boss = getBossShare(getNextWorkingDay());
  dom.daySummary.innerHTML = `
    <div class="summary-item">
      <span>Событие</span>
      <strong>${eventName}</strong>
      <small>${eventDescription}</small>
    </div>
    <div class="summary-item">
      <span>Следующая доля босса</span>
      <strong>${boss ? `${boss}$` : "0$"}</strong>
      <small>Если денег не хватит, появится долг.</small>
    </div>
    <div class="summary-item">
      <span>Заказ дня</span>
      <strong>${state.day >= 2 ? `${getOrderDemand()} кокт.` : "нет"}</strong>
      <small>С 5 дня заказы становятся тяжелее.</small>
    </div>
  `;
  dom.journalDayLabel.textContent = formatDayLabel();
  dom.journalCurrentEvent.innerHTML = `
    <article>
      <span>${escapeHtml(state.event ? "Активно" : "Спокойно")}</span>
      <strong>${escapeHtml(eventName)}</strong>
      <p>${escapeHtml(eventDescription)}</p>
    </article>
  `;

  dom.repToSympathyButton.disabled = runtime.appMode === "edit" || state.resources.reputation < 1 || !getSelectedAgent();
}
