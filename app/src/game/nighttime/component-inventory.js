import { getIngredientById } from "./cocktail-data.js";

export function isBarAdditive(ingredient) {
  return ingredient?.type === "additive" && ingredient.additiveCategory === "bar";
}

export function createRandomComponentInventory(ingredients, settings, random = Math.random) {
  const min = settings.resourceRandomMin;
  const max = settings.resourceRandomMax;
  const range = max - min + 1;
  return Object.fromEntries(ingredients.filter((ingredient) => !isBarAdditive(ingredient)).map((ingredient) => [ingredient.id, min + Math.floor(random() * range)]));
}

export function countReservedComponents(slots) {
  return Object.values(slots).reduce((counts, ingredientId) => {
    counts[ingredientId] = (counts[ingredientId] || 0) + 1;
    return counts;
  }, {});
}

export function getAvailableComponentUnits(inventory, slots, ingredientId) {
  if (isBarAdditive(getIngredientById(ingredientId))) return Infinity;
  return Math.max(0, (inventory[ingredientId] || 0) - (countReservedComponents(slots)[ingredientId] || 0));
}

export function hasComponentsForSlots(inventory, slots) {
  return Object.entries(countReservedComponents(slots)).every(([ingredientId, count]) => isBarAdditive(getIngredientById(ingredientId)) || (inventory[ingredientId] || 0) >= count);
}

export function consumeComponents(inventory, slots) {
  const reserved = countReservedComponents(slots);
  return Object.fromEntries(Object.entries(inventory).filter(([ingredientId]) => !isBarAdditive(getIngredientById(ingredientId))).map(([ingredientId, count]) => [ingredientId, count - (reserved[ingredientId] || 0)]));
}
