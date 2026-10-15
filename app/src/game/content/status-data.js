export const statusEffects = [
  { id: "physical-training", name: "Физический тренинг", description: "Даёт преимущество при физических проверках.", duration: 5, maxStacks: 1, effects: [{ type: "check_advantage", scope: "physical" }] },
  { id: "social-training", name: "Социальный тренинг", description: "Даёт преимущество при социальных проверках.", duration: 5, maxStacks: 1, effects: [{ type: "check_advantage", scope: "social" }] },
  { id: "mental-training", name: "Ментальный тренинг", description: "Даёт преимущество при ментальных проверках.", duration: 5, maxStacks: 1, effects: [{ type: "check_advantage", scope: "mental" }] },
  { id: "hangover", name: "Похмелье", description: "Даёт штраф при любых проверках.", duration: 1, maxStacks: 2, effects: [{ type: "check_penalty", scope: "any" }] },
  { id: "bruises-and-scratches", name: "Синяки и царапины", description: "-1 к восстановлению энергии за стак.", duration: 3, maxStacks: 5, effects: [{ type: "agent_parameter_delta", parameter: "recovery", amount: -1 }] },
  { id: "injury", name: "Травма", description: "-3 к восстановлению энергии и даёт штраф при физических проверках.", duration: 5, maxStacks: 1, effects: [{ type: "agent_parameter_delta", parameter: "recovery", amount: -3 }, { type: "check_penalty", scope: "physical" }] },
  { id: "stress", name: "Стресс", description: "-25% к получению симпатии и даёт штраф при ментальных и социальных проверках.", duration: 5, maxStacks: 1, effects: [{ type: "sympathy_gain_percent", percent: -25 }, { type: "check_penalty", scope: "mental" }, { type: "check_penalty", scope: "social" }] },
  { id: "diligence", name: "Исполнительность", description: "Переработка стоит вдвое меньше симпатии.", duration: 2, maxStacks: 1, effects: [{ type: "overtime_sympathy_cost_percent", percent: -50 }] },
  { id: "inspiration", name: "Вдохновение", description: "Даёт преимущество при любой проверке и тратит один стак.", duration: 2, maxStacks: 3, effects: [{ type: "temporary_check_advantage", scope: "any" }] },
  { id: "vigor", name: "Бодрость", description: "+1 к восстановлению энергии за стак.", duration: 3, maxStacks: 5, effects: [{ type: "agent_parameter_delta", parameter: "recovery", amount: 1 }] },
];
