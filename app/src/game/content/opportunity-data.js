import { applyBloodMerchantAward, applyCoffeeTasting, applyFoundWallet, applyInfluencerReview, applyNoopOpportunity, applyOvkPraise, applyOvkTax, applyPersonalOrder, applyUpsetAgent, applyVampireCache, applyWildVampireAttack } from "./opportunity-effects.js";

export const opportunityTable = {
  2: { name: "Нападение дикого вампира", apply: applyWildVampireAttack },
  3: { name: "Налог от ОВК", apply: applyOvkTax },
  4: { name: "Расстроил сотрудника", apply: applyUpsetAgent },
  5: { name: "Пшик", apply: applyNoopOpportunity },
  6: { name: "Нашёл кошелёк", apply: applyFoundWallet },
  7: { name: "Дегустация кофе", apply: applyCoffeeTasting },
  8: { name: "Вампирский тайник", apply: applyVampireCache },
  9: { name: "Отзыв от инфлюенсера", apply: applyInfluencerReview },
  10: { name: "Индивидуальный заказ", apply: applyPersonalOrder },
  11: { name: "Похвала от ОВК", apply: applyOvkPraise },
  12: { name: "Премия Кроветорговец года", apply: applyBloodMerchantAward },
};
