export const FATIGUE_MIN = 0;
export const FATIGUE_MAX = 10;

function toInteger(value, fallback = 0) {
  const numericValue = Math.trunc(Number(value));
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function normalizeAgentFatigue(value, fallback = FATIGUE_MIN) {
  const integerValue = toInteger(value, fallback);
  return Math.min(FATIGUE_MAX, Math.max(FATIGUE_MIN, integerValue));
}

export function getAgentFatigue(agent) {
  return normalizeAgentFatigue(agent?.fatigue);
}

export function adjustAgentFatigue(agent, amount = 0) {
  if (!agent) return 0;
  const before = getAgentFatigue(agent);
  const after = normalizeAgentFatigue(before + toInteger(amount));
  agent.fatigue = after;
  return after - before;
}
