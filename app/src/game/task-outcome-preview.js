import { resourceDefs, state } from "./state.js";
import { locations, statusEffects, upgrades } from "./data.js";
import { TASK_EFFECT_DEFINITIONS } from "./task-effect-registry.js";
import { resolveLocationMechanic, resolveLocationShopOffer } from "./location-mechanics.js";
import { getLocationTaskEffects } from "./location-mechanic-effects-runtime.js";
import { parseEffectNumber } from "./effect-value.js";

const TASK_PARAMETER_LABELS = {
  energy: "Энергия",
  recovery: "Восстановление",
  sympathy: "Симпатия",
  overtime: "Переработка",
  fatigue: "Усталость",
};

function formatEffectAmount(value) {
  const parsed = parseEffectNumber(value);
  if (!parsed) return "0";
  if (parsed.min === parsed.max) return String(parsed.min);
  return `[${parsed.min}, ${parsed.max}]`;
}

function formatSignedEffectAmount(value) {
  const formatted = formatEffectAmount(value);
  return !formatted.startsWith("-") ? `+${formatted}` : formatted;
}

function addPreviewRange(target, resource, value) {
  const parsed = parseEffectNumber(value);
  if (!parsed) return;
  const current = target[resource] || { min: 0, max: 0 };
  target[resource] = { min: current.min + parsed.min, max: current.max + parsed.max };
}

function formatPreviewResource(resource, range) {
  if (range.min === range.max) {
    const sign = range.min > 0 ? "+" : "";
    return `${sign}${range.min}${resource === "money" ? "$" : ` ${resourceDefs[resource]?.short || resource}`}`;
  }
  const sign = range.min >= 0 ? "+" : "";
  return `${sign}[${range.min}, ${range.max}]${resource === "money" ? "$" : ` ${resourceDefs[resource]?.short || resource}`}`;
}

export function getTaskOutcomeEffectPreview(task, outcome) {
  const field = outcome === "success" ? "success" : "failure";
  const ranges = {};
  const legacyOutcome = task[field] || {};
  Object.entries(legacyOutcome).forEach(([resource, amount]) => {
    if (resource !== "fatigue") addPreviewRange(ranges, resource, amount);
  });
  const legacyFatigue = parseEffectNumber(legacyOutcome.fatigue);
  const effectField = outcome === "success" ? "successEffects" : "failureEffects";
  const locationEffects = getLocationTaskEffects(state, task.locationId, task.id, outcome);
  const allEffects = [...(task[effectField] || []), ...locationEffects];
  allEffects.forEach((effect) => {
    if (effect.type === "resource_delta") addPreviewRange(ranges, effect.resource, effect.amount);
  });
  const resourceEffects = Object.entries(ranges)
    .filter(([, range]) => range.min !== 0 || range.max !== 0)
    .map(([resource, range]) => ({
      label: resourceDefs[resource]?.label || resource,
      value: formatPreviewResource(resource, range),
    }));
  const legacyFatigueEffect = legacyFatigue && (legacyFatigue.min !== 0 || legacyFatigue.max !== 0)
    ? [{ label: "Усталость", value: formatSignedEffectAmount(legacyOutcome.fatigue) }]
    : [];
  const parameterAndUpgradeEffects = allEffects.flatMap((effect) => {
    if (effect.type === "resource_delta") return [];
    if (effect.type === "agent_parameter_delta") {
      return [{
        label: TASK_PARAMETER_LABELS[effect.parameter] || effect.parameter,
        value: formatSignedEffectAmount(effect.amount),
      }];
    }
    if (effect.type === "grant_upgrade") {
      const upgradeId = String(effect.upgradeId || "any").trim();
      const upgradeName = upgradeId === "any" ? "Первый доступный" : upgrades.find((upgrade) => upgrade.id === upgradeId)?.name || upgradeId;
      return [{ label: "Апгрейд", value: upgradeName }];
    }
    if (effect.type === "grant_status") {
      const status = statusEffects.find((item) => item.id === String(effect.statusId || ""));
      const stacks = Math.max(1, Number(effect.stacks) || 1);
      return [{
        label: "Статус",
        value: `${status?.name || "не выбран"}${stacks > 1 ? ` x${stacks}` : ""}`,
        tooltip: status?.description || "Описание статуса отсутствует.",
      }];
    }
    const location = locations.find((item) => item.id === task.locationId);
    if (effect.type === "location_counter_increase") {
      const counter = resolveLocationMechanic(location, effect.counterId, "counter")?.mechanic;
      return [{ label: counter?.name || "не выбран", value: formatSignedEffectAmount(effect.amount) }];
    }
    if (effect.type === "location_scale_decrease") {
      const scale = resolveLocationMechanic(location, effect.scaleId, "scale")?.mechanic;
      return [{ label: scale?.name || "не выбрана", value: formatSignedEffectAmount(effect.amount) }];
    }
    if (["location_shop_stock_increase", "location_shop_offer_lock"].includes(effect.type)) {
      const offer = resolveLocationShopOffer(location, effect.shopId, effect.offerId)?.offer;
      const resource = resourceDefs[offer?.resource]?.label || "товар";
      return effect.type === "location_shop_stock_increase"
        ? [{ label: resource, value: `${formatSignedEffectAmount(effect.amount)} ед.` }]
        : [{ label: resource, value: effect.locked ? "заблокировать" : "разблокировать" }];
    }
    const definition = TASK_EFFECT_DEFINITIONS.find((item) => item.type === effect.type);
    return definition ? [{ label: definition.label, value: "Настроен" }] : [{ label: effect.type || "Эффект", value: "Настроен" }];
  });

  return [...resourceEffects, ...legacyFatigueEffect, ...parameterAndUpgradeEffects];
}
