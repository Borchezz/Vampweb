export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeDie(value, options, fallback) {
  const parsed = Number(value);
  return options.includes(parsed) ? parsed : fallback;
}
