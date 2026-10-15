import { state } from "./state.js";
import { escapeAttribute, escapeHtml, formatResourceObject } from "./rules.js";
import { getLocationCounters } from "./location-counters.js";
import { getLocationScales, getLocationShopOfferState, getLocationShops } from "./location-mechanics.js";

function renderLocationCounter(counter) {
  return `<section class="location-counter" aria-label="${escapeAttribute(counter.name)}: ${counter.value} из ${counter.segments}">
    <div class="location-counter-clock" style="--counter-fill:${counter.value / counter.segments}turn"><strong>${counter.value}/${counter.segments}</strong></div>
    <div><strong>${escapeHtml(counter.name)}</strong><small>${escapeHtml(counter.counterType)}</small></div>
  </section>`;
}

function renderLocationScale(scale) {
  const range = Math.max(1, scale.max - scale.min);
  const fill = Math.max(0, Math.min(100, ((scale.value - scale.min) / range) * 100));
  const thresholds = scale.thresholds
    .map((threshold) => {
      const position = Math.max(0, Math.min(100, ((threshold.value - scale.min) / range) * 100));
      const edge = threshold.value === scale.min ? " start" : threshold.value === scale.max ? " end" : "";
      return `<span class="location-scale-threshold${edge}" style="left:${position}%" aria-label="Порог ${threshold.value}"><span>${threshold.value}</span></span>`;
    })
    .join("");
  return `<section class="location-scale" aria-label="${escapeAttribute(scale.name)}: ${scale.value}">
    <div class="location-scale-heading"><strong>${escapeHtml(scale.name)}</strong><span><b>${scale.value}</b><small>${scale.min} — ${scale.max}</small></span></div>
    <div class="location-scale-meter">
      <div class="location-scale-track" role="progressbar" aria-valuemin="${scale.min}" aria-valuemax="${scale.max}" aria-valuenow="${scale.value}"><span class="location-scale-fill" style="width:${fill}%"></span></div>
      <div class="location-scale-thresholds" aria-hidden="true">${thresholds}</div>
    </div>
  </section>`;
}

function renderShopOffers(title, shop, offers, action, locationId, index) {
  if (!offers.length) return `<section class="location-shop-offers"><h4>${title}</h4><p>Нет доступных предложений.</p></section>`;
  return `<section class="location-shop-offers"><h4>${title}</h4>${offers.map((offer, offerIndex) => {
    const offerState = action === "buy" ? getLocationShopOfferState(state, locationId, shop.id, offer.id, offer) : { locked: offer.locked };
    const disabled = offerState.locked || (action === "buy" && offerState.stock <= 0);
    const availability = action === "buy" ? (offerState.locked ? "Заблокировано" : `В наличии: ${offerState.stock}/${offer.maxStock}`) : (offerState.locked ? "Заблокировано" : `${offer.price}$ за ед.`);
    return `<div class="location-shop-offer"><span><strong>${escapeHtml(formatResourceObject({ [offer.resource]: 1 }, false))}</strong><small>${availability}</small></span><button class="secondary-button compact-button" type="button" data-location-shop-trade="${action}" data-location-shop-location="${escapeAttribute(locationId)}" data-location-shop-index="${index}" data-location-shop-offer="${offerIndex}" ${disabled ? "disabled" : ""}>${action === "buy" ? "Купить" : "Продать"}</button></div>`;
  }).join("")}</section>`;
}

function renderLocationShop(shop, index, locationId) {
  const open = state.openLocationShopId === `${locationId}:${index}`;
  return `<section class="location-shop ${open ? "open" : ""}">
    <div class="location-shop-heading"><strong>${escapeHtml(shop.name)}</strong><button class="secondary-button compact-button" type="button" data-location-shop-toggle="${escapeAttribute(locationId)}" data-location-shop-index="${index}">${open ? "Закрыть" : "Магазин"}</button></div>
    ${open ? `<div class="location-shop-panel" aria-label="${escapeAttribute(shop.name)}">${renderShopOffers("Купить", shop, shop.sellOffers, "buy", locationId, index)}${renderShopOffers("Продать", shop, shop.buyOffers, "sell", locationId, index)}</div>` : ""}
  </section>`;
}

export function renderLocationMechanics(location) {
  return [
    ...getLocationCounters(location, state).map(renderLocationCounter),
    ...getLocationScales(location, state).map(renderLocationScale),
    ...getLocationShops(location).map((shop, index) => renderLocationShop(shop, index, location.id)),
  ].join("");
}
