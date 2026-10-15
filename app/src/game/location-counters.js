import { getLocationMechanicValue, LOCATION_MECHANIC_TYPES } from "./location-mechanics.js";
import { normalizeLocationCounterMechanic } from "./location-mechanic-contract.js";

export const LOCATION_COUNTER_TYPES = ["fillable", "self_filling", "decaying", "fillable_decaying"];

export function normalizeLocationCounter(counter = {}) {
  return normalizeLocationCounterMechanic(counter);
}

export function getLocationCounters(location, targetState) {
  return (location?.mechanics || [])
    .map((mechanic, index) => ({ mechanic, index }))
    .filter(({ mechanic }) => mechanic?.type === LOCATION_MECHANIC_TYPES.counter)
    .map(({ mechanic }) => {
      const counter = normalizeLocationCounter(mechanic);
      return { ...counter, value: getLocationMechanicValue(targetState, location.id, LOCATION_MECHANIC_TYPES.counter, counter.id, counter.value) };
    });
}
