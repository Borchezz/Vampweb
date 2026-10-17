// Random choices belong to a visit, not to the current recipe.
export function startClientVisit(state, profile) {
  clearCocktail(state);
  state.clientProfile = profile;
  state.clientNotice = "";
  state.randomChoices = {};
}

export function removeCocktailIngredient(state, slotId) {
  delete state.slots[slotId];
  state.prepared = false;
}

export function clearCocktail(state) {
  state.slots = {};
  state.preparation = {};
  state.prepared = false;
}
