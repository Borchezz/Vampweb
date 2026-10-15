export const eventDeck = [
  {
    id: "great-weather",
    name: "Прекрасная погода",
    description: "+3 энергии всем агентам.",
    effects: [{ type: "agent_parameter_delta", parameter: "energy", amount: 3 }],
  },
  {
    id: "awful-weather",
    name: "Ужасная погода",
    description: "-3 энергии всем агентам.",
    effects: [{ type: "agent_parameter_delta", parameter: "energy", amount: -3 }],
  },
  {
    id: "blood-merchant-day",
    name: "Международный день кроветорговца",
    description: "Все агенты получают +3 симпатии.",
    effects: [{ type: "agent_parameter_delta", parameter: "sympathy", amount: 3 }],
  },
  {
    id: "fridge-spoilage",
    name: "Порча холодильника",
    description: "В конце дня пропадёт кровь Т1, если нет апгрейда холодильника.",
    effects: [
      { type: "end_of_day_resource_set", resource: "bloodTier1", amount: 0 },
    ],
  },
  {
    id: "labor-solidarity-day",
    name: "День солидарности трудящихся",
    description: "Сегодня нельзя пользоваться переработками.",
    effects: [{ type: "disable_overtime" }],
  },
  {
    id: "ovk-raid",
    name: "Рейд силовиков ОВК",
    description: "Изъято до 4 ед. сырой крови.",
    effects: [
      { type: "resource_delta", resource: "bloodTier1", amount: -4 },
    ],
  },
];
