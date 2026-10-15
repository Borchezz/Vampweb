import { resourceDefs, statDefs, runtime, state } from "./state.js";
import { getAgentEffectiveFatigue, getAgentEffectiveSympathy, getAgentMaxEnergy, getAgentOvertimeMax, getAgentSpecialtyStats } from "./trait-effects-runtime.js";
import { getActiveSympathyTraitEntries, getSympathySectionInfo, getSympathyTraitEntries, formatSignedNumber } from "./agent-traits.js";
import { isAgentSympathyEnabled } from "./agent-main-character.js";
import { findTraitByRef, getTraitDescription, getTraitDisplayName } from "./trait-catalog.js";
import { FATIGUE_MAX } from "./agent-parameters.js";
import { dom } from "./dom.js";
import { escapeHtml, getAvailableOvertime, getLocation, getRecovery, getRecoveryBreakdown } from "./rules.js";
import { normalizeTraitEffect, TRAIT_AGENT_PARAMETER_OPTIONS } from "./trait-effect-registry.js";

function traitKey(entry) {
  return `${entry.section}:${entry.trait}`;
}

function getTraitEffectValue(effect) {
  switch (effect.type) {
    case "agent_parameter_delta": {
      const parameter = TRAIT_AGENT_PARAMETER_OPTIONS.find((option) => option.value === effect.parameter);
      return `${parameter?.label || effect.parameter}: ${formatSignedNumber(effect.amount)}`;
    }
    case "sympathy_gain_percent":
      return `${formatSignedNumber(effect.percent)}% к положительному приросту симпатии`;
    case "upkeep_cost":
      return `${effect.amount} ${resourceDefs[effect.resource]?.short || effect.resource} в начале дня`;
    case "movement_cost_percent":
      return `${formatSignedNumber(effect.percent)}% к стоимости перемещения`;
    case "specialization":
      return statDefs[effect.stat]?.full || effect.stat;
    case "movement_cost_delta":
      return `${formatSignedNumber(effect.amount)} энергии за шаг`;
    default:
      return "";
  }
}

function renderTraitEffects(trait) {
  const effects = (trait?.effects || []).map((effect) => normalizeTraitEffect(effect)).filter(Boolean);
  if (!effects.length) return "";
  return `
    <ul class="agent-profile-effects" aria-label="Эффекты черты">
      ${effects
        .map(
          (effect) => `
            <li>
              <strong>${escapeHtml(getTraitEffectValue(effect))}</strong>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderTraitEntry(traitRef, options = {}) {
  const trait = findTraitByRef(traitRef);
  const className = options.inactive ? "agent-profile-trait inactive" : "agent-profile-trait";
  const meta = options.meta ? `<small>${escapeHtml(options.meta)}</small>` : "";
  const stateLabel = options.inactive ? '<span class="agent-profile-trait-state">Неактивна</span>' : "";
  return `
    <article class="${className}">
      <div>
        <strong>${escapeHtml(trait?.name || getTraitDisplayName(traitRef))}</strong>
        <p>${escapeHtml(trait?.description || getTraitDescription(traitRef))}</p>
        ${meta}
        ${renderTraitEffects(trait)}
      </div>
      ${stateLabel}
    </article>
  `;
}

function renderTraits(agent) {
  const regularTraits = Array.isArray(agent.traits) ? agent.traits : [];
  const sympathyTraits = getSympathyTraitEntries(agent);
  const activeSympathyTraits = new Set(getActiveSympathyTraitEntries(agent).map(traitKey));
  const entries = [
    ...regularTraits.map((trait) => renderTraitEntry(trait)),
    ...sympathyTraits.map((entry) =>
      renderTraitEntry(entry.trait, {
        inactive: !activeSympathyTraits.has(traitKey(entry)),
        meta: `Черта симпатии: секция ${formatSignedNumber(entry.section)}`,
      })
    ),
  ];

  return entries.length ? entries.join("") : '<p class="agent-profile-empty">У агента пока нет черт.</p>';
}

export function renderAgentProfile() {
  const agent = state.agents.find((entry) => entry.id === runtime.agentProfileAgentId);
  const isOpen = Boolean(agent);
  dom.agentProfilePanel.hidden = !isOpen;
  dom.agentProfilePanel.setAttribute("aria-hidden", String(!isOpen));
  if (!agent) return;

  const maxEnergy = getAgentMaxEnergy(agent);
  const overtimeMax = getAgentOvertimeMax(agent);
  const sympathyEnabled = isAgentSympathyEnabled(agent);
  const sympathy = getAgentEffectiveSympathy(agent);
  const sympathySection = getSympathySectionInfo(sympathy);
  const specialties = getAgentSpecialtyStats(agent);
  const location = getLocation(agent.locationId);

  dom.agentProfileContent.innerHTML = `
    <header class="agent-profile-header">
      <span class="agent-profile-portrait" style="--portrait: ${escapeHtml(agent.color)}">${escapeHtml(agent.portrait)}</span>
      <span>
        <p class="eyebrow">${agent.isMainCharacter ? "Главный герой" : "Агент"}</p>
        <h2 id="agentProfileTitle">${escapeHtml(agent.name)}</h2>
        <p>${escapeHtml(agent.role)}</p>
        ${agent.isMainCharacter ? '<span class="agent-profile-main-character">Главный герой</span>' : ""}
      </span>
    </header>
    <section class="agent-profile-section" aria-label="Параметры агента">
      <h3>Параметры</h3>
      <div class="agent-profile-stats">
        <span><small>Энергия</small><strong>${agent.energy}/${maxEnergy}</strong></span>
        <span><small>Переработка</small><strong>${getAvailableOvertime(agent)}/${overtimeMax}</strong></span>
        <span><small>Восстановление</small><strong>${formatSignedNumber(getRecovery(agent))}</strong></span>
        <span><small>Усталость</small><strong>${getAgentEffectiveFatigue(agent)}/${FATIGUE_MAX}</strong></span>
        ${
          sympathyEnabled
            ? `<span><small>Симпатия</small><strong>${sympathy} <em>${sympathySection.label}</em></strong></span>`
            : ""
        }
        <span><small>Локация</small><strong>${escapeHtml(location?.name || "Не выбрана")}</strong></span>
      </div>
      <p class="agent-profile-recovery">${escapeHtml(getRecoveryBreakdown(agent))}</p>
    </section>
    <section class="agent-profile-section" aria-label="Специализации агента">
      <h3>Специализации</h3>
      <div class="agent-profile-specialties">
        ${
          specialties.length
            ? specialties.map((stat) => `<span>${escapeHtml(statDefs[stat]?.full || stat)}</span>`).join("")
            : '<p class="agent-profile-empty">Специализации не выбраны.</p>'
        }
      </div>
    </section>
    <section class="agent-profile-section" aria-label="Черты агента">
      <h3>Черты</h3>
      <div class="agent-profile-traits">${renderTraits(agent)}</div>
    </section>
  `;
}
