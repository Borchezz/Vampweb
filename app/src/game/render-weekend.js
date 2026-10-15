import { activities } from "./data.js";
import { dom } from "./dom.js";
import { resourceDefs, runtime, state } from "./state.js";
import { WEEKEND_ACTIVITY_LIMIT, getWeekendActivityCost } from "./action-weekend.js";
import { canAfford, escapeAttribute, escapeHtml, formatDayLabel, formatResourceObject, getMainCharacter } from "./rules.js";
import { parseEffectNumber } from "./effect-value.js";

const ACTIVITY_KIND_LABELS = {
  solo: "Одиночная",
  pair: "Парная",
  group: "Групповая",
};

const ACTIVITY_TARGET_LABELS = {
  main: "Главному герою",
  partner: "Напарнику",
  all: "Всем агентам",
};

const ACTIVITY_PARAMETER_LABELS = {
  energy: "Энергия",
  recovery: "Восстановление",
  sympathy: "Симпатия",
  overtime: "Переработка",
  fatigue: "Усталость",
};

export function renderWeekendPanel() {
  const active = Boolean(state.weekend?.active) && runtime.appMode !== "edit";
  const completedActivityIds = state.weekend?.completedActivityIds || [];
  const mainCharacter = getMainCharacter();

  dom.weekendPanel.classList.toggle("open", active);
  dom.weekendPanel.setAttribute("aria-hidden", String(!active));
  dom.weekendPanel.inert = !active;
  if (!active) return;

  dom.weekendDayLabel.textContent = formatDayLabel();
  dom.weekendProgress.textContent = `Выбрано ${completedActivityIds.length} из ${WEEKEND_ACTIVITY_LIMIT}`;
  dom.weekendActivityList.innerHTML = activities.length
    ? activities.map((activity) => renderWeekendActivity(activity, mainCharacter, completedActivityIds)).join("")
    : '<p class="weekend-empty-state">Доступных активностей пока нет.</p>';
}

function renderWeekendActivity(activity, mainCharacter, completedActivityIds) {
  const completed = completedActivityIds.includes(activity.id);
  const cost = getWeekendActivityCost(activity);
  const canAffordActivity = canAfford(cost);
  const availablePartners = activity.kind === "pair" && mainCharacter ? state.agents.filter((agent) => agent.id !== mainCharacter.id) : [];
  const missingPartner = activity.kind === "pair" && !availablePartners.length;
  const disabled = completed || !mainCharacter || !canAffordActivity || missingPartner;
  const status = completed
    ? "Уже выбрано"
    : !mainCharacter
      ? "Нужен главный герой"
      : missingPartner
        ? "Нет напарника"
        : !canAffordActivity
          ? "Не хватает ресурсов"
          : "Выбрать";
  const costText = formatResourceObject(cost, false);

  return `
    <article class="weekend-activity-card ${completed ? "done" : ""}">
      <div class="weekend-activity-heading">
        <div>
          <h3>${escapeHtml(activity.name)}</h3>
          <div class="task-meta">
            <span class="tag">${escapeHtml(ACTIVITY_KIND_LABELS[activity.kind] || "Активность")}</span>
            ${costText === "без ресурсов" ? "" : `<span class="tag">${escapeHtml(costText)}</span>`}
          </div>
        </div>
      </div>
      <p>${escapeHtml(activity.description)}</p>
      ${renderWeekendEffects(activity)}
      <p class="weekend-result">${escapeHtml(activity.resultDescription)}</p>
      ${renderWeekendPartnerPicker(activity, availablePartners, completed || !mainCharacter)}
      <button class="secondary-button compact-button" type="button" data-weekend-activity-id="${escapeAttribute(activity.id)}" ${disabled ? "disabled" : ""}>
        ${escapeHtml(status)}
      </button>
    </article>
  `;
}

function renderWeekendEffects(activity) {
  const items = getWeekendActivityEffectPreview(activity)
    .map((effect) => `<li><span>${escapeHtml(effect.label)}</span><strong>${escapeHtml(effect.value)}</strong></li>`);

  if (!items.length) return '<p class="weekend-effect-empty">Эффекты не заданы.</p>';
  return `<section class="weekend-effects"><span class="weekend-effects-title">Эффекты</span><ul>${items.join("")}</ul></section>`;
}

export function getWeekendActivityEffectPreview(activity) {
  return (activity?.effects || []).flatMap((effect) => {
    if (effect.type === "resource_delta") {
      const resourceLabel = resourceDefs[effect.resource]?.label || effect.resource;
      const parsed = parseEffectNumber(effect.amount);
      const value = parsed && parsed.min !== parsed.max ? `[${parsed.min}, ${parsed.max}]` : parsed?.min || 0;
      return [{ label: resourceLabel, value: formatResourceObject({ [effect.resource]: value }) }];
    }
    if (effect.type === "agent_parameter_delta") {
      const targetLabel = ACTIVITY_TARGET_LABELS[effect.target] || "Главному герою";
      const parameterLabel = ACTIVITY_PARAMETER_LABELS[effect.parameter] || effect.parameter;
      const parsed = parseEffectNumber(effect.amount);
      const amount = parsed && parsed.min !== parsed.max ? `[${parsed.min}, ${parsed.max}]` : parsed?.min || 0;
      return [{ label: `${targetLabel}: ${parameterLabel}`, value: `${String(amount).startsWith("-") ? "" : "+"}${amount}` }];
    }
    return [];
  });
}

function renderWeekendPartnerPicker(activity, partners, disabled) {
  if (activity.kind !== "pair") return "";
  if (!partners.length) return '<p class="weekend-partner-empty">Для активности нужен другой агент.</p>';
  return `
    <label class="weekend-partner-picker">
      <span>Напарник</span>
      <select data-weekend-partner-id="${escapeAttribute(activity.id)}" ${disabled ? "disabled" : ""}>
        ${partners.map((agent) => `<option value="${escapeAttribute(agent.id)}">${escapeHtml(agent.name)}</option>`).join("")}
      </select>
    </label>
  `;
}
