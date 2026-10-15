import { PREFERENCE_ATTITUDE_LABEL } from "./client-preferences.js";
import { TAG_DEFINITIONS, tagSupportsDegree } from "./cocktail-data.js";
import { getNighttimeSettings } from "./settings.js";

function getBaseScore(attitude, settings) {
  return Math.abs(attitude) === 2 ? settings.satisfactionStronglyLikeBase : settings.satisfactionLikeBase;
}

export function evaluateClientSatisfaction(cocktail, profile) {
  const cocktailTags = new Map(cocktail.tags.map((tag) => [tag.id, tag]));
  const settings = getNighttimeSettings();
  const preferences = profile.preferences.map((preference) => {
    const cocktailTag = cocktailTags.get(preference.tagId);
    const present = Boolean(cocktailTag);
    const degree = preference.attitude > 0 && tagSupportsDegree(preference.tagId) ? preference.degree || 1 : null;
    const degreeDifference = degree && present ? Math.abs((cocktailTag.degree || 1) - degree) : 0;
    const adjustedScore = getBaseScore(preference.attitude, settings) / 2 ** degreeDifference;
    const satisfied = preference.attitude === 0 || (preference.attitude > 0 ? present : !present);
    const score = preference.attitude === 0 ? 0 : preference.attitude > 0 ? (present ? adjustedScore : -adjustedScore) : (present ? -getBaseScore(preference.attitude, settings) : 0);
    return {
      ...preference,
      label: TAG_DEFINITIONS[preference.tagId]?.label || preference.tagId,
      attitudeLabel: PREFERENCE_ATTITUDE_LABEL[preference.attitude],
      present,
      degree,
      degreeDifference,
      satisfied,
      score,
    };
  });
  return {
    score: preferences.reduce((total, preference) => total + preference.score, 0),
    preferences,
  };
}
