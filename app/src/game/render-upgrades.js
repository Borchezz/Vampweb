import { runtime, state } from "./state.js";
import { upgrades } from "./data.js";
import { dom } from "./dom.js";
import { canAfford, formatResourceObject, getSelectedAgent } from "./rules.js";

export function renderUpgrades() {
  const selectedAgent = getSelectedAgent();
  const atShop = selectedAgent.locationId === "upgrade-shop";
  dom.upgradeList.innerHTML = upgrades
    .map((upgrade) => {
      const bought = state.purchasedUpgrades.includes(upgrade.id);
      const canBuy = runtime.appMode !== "edit" && atShop && !bought && canAfford(upgrade.cost);
      return `
        <article class="upgrade-card ${bought ? "bought" : ""}">
          <div>
            <strong>${upgrade.name}</strong>
            <p class="muted">${upgrade.description}</p>
            <span class="tag">${formatResourceObject(upgrade.cost, false)}</span>
          </div>
          <button class="secondary-button compact-button" type="button" data-upgrade-id="${upgrade.id}" ${canBuy ? "" : "disabled"}>
            ${bought ? "Куплено" : atShop ? "Купить" : "Нужен магазин"}
          </button>
        </article>
      `;
    })
    .join("");
}
