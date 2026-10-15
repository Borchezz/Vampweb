const INSTANCE_BY_PORT = {
  4173: "main",
  4174: "main",
  4211: "editor",
  4212: "editor",
  4213: "map",
  4214: "map",
  4215: "tasks",
  4216: "tasks",
  4217: "agents",
  4218: "agents",
  4219: "tests",
  4220: "tests",
  4221: "sheets",
  4222: "sheets",
  4223: "nighttime",
  4224: "nighttime",
};

function normalizeInstanceName(value) {
  const name = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(name) ? name : "";
}

export function getGameInstanceName(location = globalThis.location) {
  const instance = normalizeInstanceName(new URLSearchParams(location?.search || "").get("instance"));
  if (instance) return instance;
  return INSTANCE_BY_PORT[location?.port] || "main";
}

export function applyGameTabTitle(document = globalThis.document, location = globalThis.location) {
  const instance = getGameInstanceName(location);
  if (document) document.title = `bloodbar - ${instance}`;
  return instance;
}
