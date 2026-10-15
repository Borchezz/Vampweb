import { sanitizeDie } from "./utils.js";

export const TASK_MECHANIC_IDS = {
  energyBaseDice: "energy-base-dice",
};

export const TASK_MECHANIC_DEFINITIONS = [
  {
    id: TASK_MECHANIC_IDS.energyBaseDice,
    label: "Куб Энергии+базовый",
    energyDie: {
      min: 1,
      max: 10,
    },
    settings: {
      baseDie: {
        label: "Базовый куб",
        options: [4, 6, 8],
        default: 4,
      },
      advantageDie: {
        label: "Куб преимущества",
        options: [2, 4, 6, 8],
        default: 4,
      },
    },
    roll({ agent, stat, energyInvestment, settings = {}, rollDie, hasSpecialty, statusAdvantage = 0, statusPenalty = 0 }) {
      const energyDie = sanitizeEnergyInvestment(energyInvestment, this.energyDie);
      const baseDie = sanitizeTaskMechanicSetting("baseDie", settings.baseDie, this.id);
      const advantageDie = sanitizeTaskMechanicSetting("advantageDie", settings.advantageDie, this.id);
      const hasMatchingSpecialty = hasSpecialty(agent, stat);
      const specialtyAdvantage = hasMatchingSpecialty ? 1 : 0;
      const advantageCount = Math.max(0, Math.trunc(Number(statusAdvantage) || 0)) + specialtyAdvantage;
      const penaltyCount = Math.max(0, Math.trunc(Number(statusPenalty) || 0));
      const base = rollDie(baseDie);
      const energy = rollDie(energyDie);
      const advantages = Array.from({ length: advantageCount }, () => rollDie(advantageDie));
      const penalties = Array.from({ length: penaltyCount }, () => -rollDie(advantageDie));
      const dice = [
        { kind: "energy", label: `Энергия d${energyDie}`, sides: energyDie, value: energy },
        { kind: "base", label: `База d${baseDie}`, sides: baseDie, value: base },
      ];

      advantages.forEach((value, index) => {
        const kind = index < specialtyAdvantage ? "specialty-advantage" : "status-advantage";
        const label = index < specialtyAdvantage ? `Специализация d${advantageDie}` : `Преимущество d${advantageDie}`;
        dice.push({ kind, label, sides: advantageDie, value });
      });
      penalties.forEach((value) => dice.push({ kind: "status-penalty", label: `Штраф d${advantageDie}`, sides: advantageDie, value }));

      return {
        mechanic: this.id,
        base,
        baseDie,
        energy,
        energyDie,
        advantageDie,
        advantageCount,
        penaltyCount,
        dice,
        total: base + energy + advantages.reduce((sum, value) => sum + value, 0) + penalties.reduce((sum, value) => sum + value, 0),
      };
    },
  },
];

export const TASK_MECHANIC_REGISTRY = Object.fromEntries(TASK_MECHANIC_DEFINITIONS.map((definition) => [definition.id, definition]));

export const DEFAULT_TASK_MECHANIC = TASK_MECHANIC_IDS.energyBaseDice;

export const TASK_MECHANIC_OPTIONS = TASK_MECHANIC_DEFINITIONS.map((definition) => ({
  value: definition.id,
  label: definition.label,
}));

export const DEFAULT_TASK_GAME_SETTINGS = createDefaultTaskGameSettings();

export const BASE_DIE_OPTIONS = getTaskMechanicSettingOptions("baseDie");
export const ADVANTAGE_DIE_OPTIONS = getTaskMechanicSettingOptions("advantageDie");

export function getTaskMechanicDefinition(mechanicId) {
  return TASK_MECHANIC_REGISTRY[mechanicId] || TASK_MECHANIC_REGISTRY[DEFAULT_TASK_MECHANIC];
}

export function sanitizeTaskMechanicId(mechanicId) {
  return TASK_MECHANIC_REGISTRY[mechanicId] ? mechanicId : DEFAULT_TASK_MECHANIC;
}

export function getTaskMechanicSettingDefinition(settingKey, mechanicId = DEFAULT_TASK_MECHANIC) {
  return getTaskMechanicDefinition(mechanicId).settings[settingKey] || null;
}

export function getTaskMechanicSettingOptions(settingKey, mechanicId = DEFAULT_TASK_MECHANIC) {
  return getTaskMechanicSettingDefinition(settingKey, mechanicId)?.options || [];
}

export function sanitizeTaskMechanicSetting(settingKey, value, mechanicId = DEFAULT_TASK_MECHANIC) {
  const setting = getTaskMechanicSettingDefinition(settingKey, mechanicId);
  if (!setting) return value;
  return sanitizeDie(value, setting.options, setting.default);
}

export function createDefaultTaskGameSettings(mechanicId = DEFAULT_TASK_MECHANIC) {
  const taskMechanic = sanitizeTaskMechanicId(mechanicId);
  return Object.fromEntries([
    ["taskMechanic", taskMechanic],
    ...Object.entries(getTaskMechanicDefinition(taskMechanic).settings).map(([key, setting]) => [key, setting.default]),
  ]);
}

export function sanitizeTaskMechanicSettings(source = {}) {
  const taskMechanic = sanitizeTaskMechanicId(source.taskMechanic);
  return {
    taskMechanic,
    baseDie: sanitizeTaskMechanicSetting("baseDie", source.baseDie, taskMechanic),
    advantageDie: sanitizeTaskMechanicSetting("advantageDie", source.advantageDie, taskMechanic),
  };
}

export function sanitizeEnergyInvestment(value, config = getTaskMechanicDefinition(DEFAULT_TASK_MECHANIC).energyDie) {
  const min = Number.isFinite(Number(config.min)) ? Number(config.min) : 1;
  const max = Number.isFinite(Number(config.max)) ? Number(config.max) : min;
  const numericValue = Math.trunc(Number(value));
  const fallback = min;
  const energy = Number.isFinite(numericValue) ? numericValue : fallback;
  return Math.max(min, Math.min(max, energy));
}

export function rollTaskCheck({ agent, stat, energyInvestment, settings, rollDie, hasSpecialty, statusAdvantage = 0, statusPenalty = 0 }) {
  const taskSettings = sanitizeTaskMechanicSettings(settings);
  return getTaskMechanicDefinition(taskSettings.taskMechanic).roll({
    agent,
    stat,
    energyInvestment,
    settings: taskSettings,
    rollDie,
    hasSpecialty,
    statusAdvantage,
    statusPenalty,
  });
}

function createUniformDistribution(sides) {
  const safeSides = Math.max(1, Math.trunc(Number(sides) || 1));
  return new Map(Array.from({ length: safeSides }, (_, index) => [index + 1, 1 / safeSides]));
}

function convolveDistributions(left, right) {
  const result = new Map();
  left.forEach((leftProbability, leftValue) => {
    right.forEach((rightProbability, rightValue) => {
      const value = leftValue + rightValue;
      result.set(value, (result.get(value) || 0) + leftProbability * rightProbability);
    });
  });
  return result;
}

function negateDistribution(distribution) {
  return new Map(Array.from(distribution, ([value, probability]) => [-value, probability]));
}

export function getTaskSuccessChance({ agent, stat, energyInvestment, settings, hasSpecialty, statusAdvantage = 0, statusPenalty = 0, difficulty = 0 }) {
  const taskSettings = sanitizeTaskMechanicSettings(settings);
  const definition = getTaskMechanicDefinition(taskSettings.taskMechanic);
  const energyDie = sanitizeEnergyInvestment(energyInvestment, definition.energyDie);
  const baseDie = sanitizeTaskMechanicSetting("baseDie", taskSettings.baseDie, definition.id);
  const advantageDie = sanitizeTaskMechanicSetting("advantageDie", taskSettings.advantageDie, definition.id);
  const matchesSpecialty = hasSpecialty(agent, stat);
  const specialtyAdvantages = matchesSpecialty ? 1 : 0;
  const advantageCount = Math.max(0, Math.trunc(Number(statusAdvantage) || 0)) + specialtyAdvantages;
  const penaltyCount = Math.max(0, Math.trunc(Number(statusPenalty) || 0));

  let distribution = convolveDistributions(createUniformDistribution(baseDie), createUniformDistribution(energyDie));
  for (let index = 0; index < advantageCount; index += 1) {
    distribution = convolveDistributions(distribution, createUniformDistribution(advantageDie));
  }
  for (let index = 0; index < penaltyCount; index += 1) {
    distribution = convolveDistributions(distribution, negateDistribution(createUniformDistribution(advantageDie)));
  }

  const target = Number(difficulty) || 0;
  if (target <= 0) return 1;
  return Array.from(distribution).reduce((chance, [total, probability]) => chance + (total >= target ? probability : 0), 0);
}
