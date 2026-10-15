const RANGE_PATTERN = /^\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]$/;
const INTEGER_PATTERN = /^-?\d+$/;

export function parseEffectNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return { min: value, max: value };
  const normalized = typeof value === "string" ? value.trim() : "";
  if (INTEGER_PATTERN.test(normalized)) {
    const number = Number(normalized);
    return { min: number, max: number };
  }
  const range = normalized.match(RANGE_PATTERN);
  if (!range) return null;
  const first = Number(range[1]);
  const second = Number(range[2]);
  return { min: Math.min(first, second), max: Math.max(first, second) };
}

export function normalizeEffectNumber(value, fallback = 0, options = {}) {
  const parsed = parseEffectNumber(value);
  if (!parsed) return fallback;
  const minimum = Number.isFinite(options.min) ? options.min : -Infinity;
  const lower = Math.max(minimum, parsed.min);
  const upper = Math.max(minimum, parsed.max);
  if (lower === upper) return lower;
  return `[${lower}, ${upper}]`;
}

export function resolveEffectNumber(value, fallback = 0, random = Math.random) {
  const parsed = parseEffectNumber(value);
  if (!parsed) return fallback;
  if (parsed.min === parsed.max) return parsed.min;
  return parsed.min + Math.floor(random() * (parsed.max - parsed.min + 1));
}

export function isEffectNumber(value) {
  return Boolean(parseEffectNumber(value));
}
