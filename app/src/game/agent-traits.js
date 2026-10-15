import { gameSettings, normalizeSympathyGameSettings } from "./state.js";
import { isAgentSympathyEnabled } from "./agent-main-character.js";
import { findTraitByRef } from "./trait-catalog.js";

export const DEFAULT_SYMPATHY_TRAIT_SECTION = 1;

export function normalizeTraitName(value) {
  const trait = String(value ?? "").trim();
  return findTraitByRef(trait)?.id || trait;
}

export function formatSignedNumber(value) {
  const numericValue = Number(value) || 0;
  return numericValue > 0 ? `+${numericValue}` : String(numericValue);
}

export function formatSympathySection(section) {
  return formatSignedNumber(section);
}

function formatScaleRange(lower, upper) {
  return lower === upper ? String(lower) : `${lower}…${upper}`;
}

export function getSympathyScaleSections(settings = gameSettings) {
  const config = normalizeSympathyGameSettings(settings);
  const halfSections = (config.sympathySections - 1) / 2;
  const leftStep = (config.sympathyStart - config.sympathyMin) / (halfSections + 0.5);
  const rightStep = (config.sympathyMax - config.sympathyStart) / (halfSections + 0.5);
  const sections = [];
  let displayLower = config.sympathyMin;

  for (let section = -halfSections; section <= halfSections; section += 1) {
    const lower =
      section < 0
        ? section === -halfSections
          ? config.sympathyMin
          : config.sympathyStart + leftStep * (section - 0.5)
        : section === 0
          ? config.sympathyStart - leftStep / 2
          : config.sympathyStart + rightStep * (section - 0.5);
    const upper =
      section < 0
        ? config.sympathyStart + leftStep * (section + 0.5)
        : section === 0
          ? config.sympathyStart + rightStep / 2
          : section === halfSections
            ? config.sympathyMax
            : config.sympathyStart + rightStep * (section + 0.5);
    const displayUpper = section === halfSections ? config.sympathyMax : Math.max(displayLower, Math.floor(upper));

    sections.push({
      section,
      label: formatSympathySection(section),
      mod: section,
      lower,
      upper,
      displayLower,
      displayUpper,
      rangeLabel: formatScaleRange(displayLower, displayUpper),
    });
    displayLower = displayUpper + 1;
  }

  return sections;
}

export function getSympathySectionInfo(value, settings = gameSettings) {
  const sections = getSympathyScaleSections(settings);
  const numericValue = Number(value);
  const firstSection = sections[0];
  const lastSection = sections[sections.length - 1];
  const clampedValue = Math.trunc(Math.min(lastSection.displayUpper, Math.max(firstSection.displayLower, Number.isFinite(numericValue) ? numericValue : 0)));
  return sections.find((section) => clampedValue >= section.displayLower && clampedValue <= section.displayUpper) || lastSection;
}

function normalizeSympathyTraitSection(entry, fallbackSection) {
  if (Number.isFinite(Number(entry?.section))) {
    return Math.trunc(Number(entry.section));
  }
  return fallbackSection;
}

function clampSympathyTraitSection(section) {
  const sections = getSympathyScaleSections();
  const firstSection = sections[0].section;
  const lastSection = sections[sections.length - 1].section;
  return Math.min(lastSection, Math.max(firstSection, section));
}

export function normalizeSympathyTraitEntry(entry, fallbackSection = DEFAULT_SYMPATHY_TRAIT_SECTION) {
  const section = clampSympathyTraitSection(normalizeSympathyTraitSection(entry, fallbackSection));
  return {
    section,
    trait: normalizeTraitName(entry?.trait),
  };
}

export function getSympathyTraitEntries(agent, options = {}) {
  const includeEmpty = Boolean(options.includeEmpty);
  const source = Array.isArray(agent?.sympathyTraits) ? agent.sympathyTraits : [];
  return source.map((entry) => normalizeSympathyTraitEntry(entry)).filter((entry) => includeEmpty || entry.trait);
}

export function getActiveSympathyTraitEntries(agent) {
  if (!isAgentSympathyEnabled(agent)) return [];
  const sympathySection = getSympathySectionInfo(agent?.sympathy).section;
  return getSympathyTraitEntries(agent)
    .filter((entry) => sympathySection >= entry.section)
    .sort((a, b) => a.section - b.section);
}

export function hasAgentTrait(agent, trait) {
  const normalizedTrait = normalizeTraitName(trait);
  return getActiveAgentTraitRefs(agent).includes(normalizedTrait);
}

export function getActiveAgentTraitRefs(agent) {
  const regularTraits = Array.isArray(agent?.traits) ? agent.traits : [];
  const sympathyTraits = getActiveSympathyTraitEntries(agent).map((entry) => entry.trait);
  return [...new Set([...regularTraits, ...sympathyTraits].map(normalizeTraitName).filter(Boolean))];
}

export function getActiveAgentTraits(agent) {
  return getActiveAgentTraitRefs(agent)
    .map((traitRef) => findTraitByRef(traitRef))
    .filter(Boolean);
}

export function getNextSympathyTraitSection(agent) {
  const entries = getSympathyTraitEntries(agent, { includeEmpty: true });
  const usedSections = new Set(entries.map((entry) => entry.section));
  const sections = getSympathyScaleSections();
  const positiveSections = sections.filter((section) => section.section > 0);
  const unusedPositiveSection = positiveSections.find((section) => !usedSections.has(section.section));
  if (unusedPositiveSection) return unusedPositiveSection.section;
  return positiveSections[0]?.section ?? DEFAULT_SYMPATHY_TRAIT_SECTION;
}
