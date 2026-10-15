import { runtime, state } from "./state.js";
import {
  getAgentRoute,
  getEnergySpendPreview,
  getLocation,
  getMoveCost,
  getSelectedAgent,
  getSelectedLocation,
  formatResourceObject,
  spendAgentEnergy,
  spendResourcesWithAgentRefund,
} from "./rules.js";
import { formatMoveCost, render } from "./render-core.js";
import { addLog, showToast } from "./action-feedback.js";
import { changeLocationShopStock, getLocationShopOfferState, getLocationShops } from "./location-mechanics.js";
import { applyResourceDelta, canAfford, spendResources } from "./gameplay-commands.js";

export function moveSelectedAgent() {
  if (state.weekend?.active) {
    showToast("Перемещения доступны в рабочие дни.");
    return;
  }
  const agent = getSelectedAgent();
  const location = getSelectedLocation();
  const cost = getMoveCost(agent, location);

  if (!cost) {
    showToast("Между этими зонами нет доступного пути.");
    return;
  }

  if (cost.energy === 0) {
    showToast(`${agent.name} уже в этой локации.`);
    return;
  }

  const energySpend = getEnergySpendPreview(agent, cost.energy, cost.toll);
  if (!energySpend.can) {
    showToast(`${agent.name} не хватает энергии или ресурсов на путь.`);
    return;
  }

  spendAgentEnergy(agent, cost.energy);
  spendResourcesWithAgentRefund(agent, cost.toll);
  agent.locationId = location.id;
  addLog(`${agent.name} перемещается в ${location.name}: ${formatMoveCost(cost)}.`);
  render();
}

export function setRoutePlanning(isPlanning) {
  state.routePlanner.planning = isPlanning;
  render();
}

export function setRoutePlannerCollapsed(isCollapsed) {
  state.routePlanner.collapsed = isCollapsed;
  if (isCollapsed) state.routePlanner.planning = false;
  render();
}

export function addSelectedLocationToRoute() {
  addLocationToRoute(state.selectedLocationId);
}

export function addLocationToRoute(locationId) {
  if (state.weekend?.active) {
    showToast("Маршрут доступен в рабочие дни.");
    return;
  }
  const agent = getSelectedAgent();
  const location = getLocation(locationId);
  if (!location) return;

  state.selectedLocationId = location.id;

  const route = [...getAgentRoute(agent)];
  const previousLocationId = route[route.length - 1] || agent.locationId;
  if (previousLocationId === location.id) {
    showToast("Эта локация уже последняя в маршруте.");
    render();
    return;
  }

  state.routePlanner.routes[agent.id] = [...route, location.id];
  state.routePlanner.collapsed = false;
  render();
}

export function removeRouteStop(index) {
  const agent = getSelectedAgent();
  const route = [...getAgentRoute(agent)];
  if (!route[index]) return;
  route.splice(index, 1);
  state.routePlanner.routes[agent.id] = route;
  render();
}

export function clearSelectedAgentRoute() {
  const agent = getSelectedAgent();
  state.routePlanner.routes[agent.id] = [];
  render();
}

export function executeNextRouteStep() {
  if (state.weekend?.active) {
    showToast("Маршрут доступен в рабочие дни.");
    return;
  }
  const agent = getSelectedAgent();
  const route = [...getAgentRoute(agent)];
  const location = getLocation(route[0]);
  if (!location) {
    showToast("Маршрут пуст.");
    return;
  }

  state.selectedLocationId = location.id;
  state.locationPanelOpen = true;

  const cost = getMoveCost(agent, location);
  if (!cost) {
    showToast("Следующая точка маршрута недоступна.");
    render();
    return;
  }

  if (cost.energy === 0) {
    route.shift();
    state.routePlanner.routes[agent.id] = route;
    showToast("Точка маршрута уже достигнута.");
    render();
    return;
  }

  const energySpend = getEnergySpendPreview(agent, cost.energy, cost.toll);
  if (!energySpend.can) {
    showToast(`${agent.name} не хватает энергии или ресурсов на маршрут.`);
    render();
    return;
  }

  spendAgentEnergy(agent, cost.energy);
  spendResourcesWithAgentRefund(agent, cost.toll);
  agent.locationId = location.id;
  route.shift();
  state.routePlanner.routes[agent.id] = route;
  addLog(`${agent.name} идёт по маршруту в ${location.name}: ${formatMoveCost(cost)}.`);
  render();
}

export function toggleLocationShop(locationId, shopIndex) {
  const shopId = `${locationId}:${shopIndex}`;
  const opening = state.openLocationShopId !== shopId;
  state.openLocationShopId = opening ? shopId : "";
  runtime.inventoryPanelOpen = opening;
  if (opening) {
    runtime.journalPanelOpen = false;
    runtime.upgradePanelOpen = false;
    runtime.barPanelOpen = false;
  }
  render();
}

export function tradeAtLocationShop(locationId, shopIndex, offerIndex, action) {
  const location = getLocation(locationId);
  const shop = getLocationShops(location)[shopIndex];
  const offer = action === "buy" ? shop?.sellOffers[offerIndex] : shop?.buyOffers[offerIndex];
  if (!location || !shop || !offer) return;

  if (action === "buy") {
    const offerState = getLocationShopOfferState(state, locationId, shop.id, offer.id, offer);
    if (offerState.locked) {
      showToast("Этот товар пока заблокирован.");
      return;
    }
    if (offerState.stock <= 0) {
      showToast("Товара нет в наличии.");
      return;
    }
    if (!canAfford({ money: offer.price })) {
      showToast("Не хватает денег на покупку.");
      return;
    }
    spendResources({ money: offer.price });
    applyResourceDelta({ [offer.resource]: 1 });
    changeLocationShopStock(state, locationId, shop.id, offer.id, offer, -1);
    addLog(`Покупка в локации «${location.name}»: ${formatResourceObject({ [offer.resource]: 1 }, false)} за ${offer.price}$.`);
  } else {
    if (offer.locked) {
      showToast("Этот товар пока недоступен для продажи.");
      return;
    }
    if (!canAfford({ [offer.resource]: 1 })) {
      showToast("Нет ресурса для продажи.");
      return;
    }
    spendResources({ [offer.resource]: 1 });
    applyResourceDelta({ money: offer.price });
    addLog(`Продажа в локации «${location.name}»: ${formatResourceObject({ [offer.resource]: 1 }, false)} за ${offer.price}$.`);
  }
  render();
}
