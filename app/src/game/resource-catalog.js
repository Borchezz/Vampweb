export const RESOURCE_CATEGORY_DEFINITIONS = [
  { id: "money", label: "Деньги" },
  { id: "whole-blood", label: "Цельная кровь" },
  { id: "additives", label: "Добавки" },
  { id: "social", label: "Социальные ресурсы" },
];

export const RESOURCE_DEFINITIONS = {
  money: { label: "Деньги", short: "$", color: "#dfb257", category: "money" },
  debt: { label: "Долг", short: "долг", color: "#6d9fce", category: "money" },
  bloodTier1: { label: "Кровь Т1", short: "Т1", color: "#d9485f", category: "whole-blood" },
  bloodTier2: { label: "Кровь Т2", short: "Т2", color: "#be4258", category: "whole-blood" },
  bloodTier3: { label: "Кровь Т3", short: "Т3", color: "#962a4d", category: "whole-blood" },
  additiveTier1: { label: "Добавка Т1", short: "Д1", color: "#48b6a7", category: "additives" },
  additiveTier2: { label: "Добавка Т2", short: "Д2", color: "#258c82", category: "additives" },
  reputation: { label: "Репутация", short: "РЕП", color: "#8a73db", category: "social" },
};

export const STANDARD_RESOURCE_IDS = ["money", "bloodTier1", "bloodTier2", "bloodTier3", "additiveTier1", "additiveTier2", "reputation"];
export const STANDARD_RESOURCE_OPTIONS = STANDARD_RESOURCE_IDS.map((value) => ({ value, label: RESOURCE_DEFINITIONS[value].label }));
export const STANDARD_RESOURCE_ERROR_MESSAGE = "must be money, bloodTier1, bloodTier2, bloodTier3, additiveTier1, additiveTier2, or reputation";
