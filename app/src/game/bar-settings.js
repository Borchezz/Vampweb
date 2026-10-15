export const DEFAULT_BAR_SETTINGS = Object.freeze({
  autoServiceLimit: 2,
  bloodPerDrink: 2,
  priceTier1: 5,
  priceTier2: 8,
  priceTier3: 12,
});

export const BAR_SETTING_METADATA = [
  { field: "autoServiceLimit", label: "Лимит напитков в день", description: "Сколько напитков бар может автоматически приготовить и продать за день.", min: 0 },
  { field: "bloodPerDrink", label: "Крови на напиток", description: "Сколько единиц крови одного тира требуется на один проданный напиток.", min: 1 },
  { field: "priceTier1", label: "Цена напитка Т1", description: "Выручка за напиток из крови Т1.", min: 0 },
  { field: "priceTier2", label: "Цена напитка Т2", description: "Выручка за напиток из крови Т2.", min: 0 },
  { field: "priceTier3", label: "Цена напитка Т3", description: "Выручка за напиток из крови Т3.", min: 0 },
];

export function normalizeBarSettings(value = {}) {
  return Object.fromEntries(
    BAR_SETTING_METADATA.map((setting) => {
      const fallback = DEFAULT_BAR_SETTINGS[setting.field];
      const numericValue = Math.trunc(Number(value[setting.field]));
      return [setting.field, Math.max(setting.min, Number.isFinite(numericValue) ? numericValue : fallback)];
    })
  );
}
