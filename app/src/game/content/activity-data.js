export const activities = [
  {
    id: "watch-series",
    name: "Просмотр сериалов",
    description: "Тихий вечер с любимым сериалом.",
    resultDescription: "Несколько серий спустя голова стала заметно легче.",
    kind: "solo",
    effects: [
      { type: "agent_parameter_delta", target: "main", parameter: "fatigue", amount: -3 },
      { type: "agent_parameter_delta", target: "main", parameter: "energy", amount: 2 },
    ],
  },
  {
    id: "walk-with-friend",
    name: "Прогулка с другом",
    description: "Спокойная совместная прогулка без рабочих разговоров.",
    resultDescription: "Вы вернулись домой отдохнувшими и чуть ближе друг к другу.",
    kind: "pair",
    effects: [
      { type: "agent_parameter_delta", target: "main", parameter: "fatigue", amount: -2 },
      { type: "agent_parameter_delta", target: "partner", parameter: "sympathy", amount: 5 },
      { type: "agent_parameter_delta", target: "partner", parameter: "fatigue", amount: -1 },
    ],
  },
  {
    id: "party",
    name: "Вечеринка",
    description: "Шумная вечеринка для всей команды.",
    resultDescription: "Было дорого, громко и очень кстати.",
    kind: "group",
    effects: [
      { type: "resource_delta", resource: "money", amount: -50 },
      { type: "agent_parameter_delta", target: "all", parameter: "sympathy", amount: 4 },
      { type: "agent_parameter_delta", target: "all", parameter: "fatigue", amount: -1 },
    ],
  },
  {
    id: "active-rest",
    name: "Активный отдых",
    description: "Небольшая прогулка, спорт и смена обстановки.",
    resultDescription: "Тело приятно устало, а голова отдохнула.",
    kind: "solo",
    effects: [{ type: "agent_parameter_delta", target: "main", parameter: "fatigue", amount: -2 }],
  },
  {
    id: "side-job",
    name: "Подработка",
    description: "Несколько часов не самой романтичной, но оплачиваемой работы.",
    resultDescription: "Деньги в кармане, силы на исходе.",
    kind: "solo",
    effects: [
      { type: "resource_delta", resource: "money", amount: 25 },
      { type: "agent_parameter_delta", target: "main", parameter: "fatigue", amount: 1 },
    ],
  },
];
