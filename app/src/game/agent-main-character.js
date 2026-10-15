import { gameSettings } from "./state.js";

export function isMainCharacter(agent) {
  return Boolean(agent?.isMainCharacter);
}

export function isMainCharacterSympathyEnabled(settings = gameSettings) {
  return settings?.mainCharacterSympathyEnabled !== false;
}

export function isAgentSympathyEnabled(agent, settings = gameSettings) {
  return !isMainCharacter(agent) || isMainCharacterSympathyEnabled(settings);
}
