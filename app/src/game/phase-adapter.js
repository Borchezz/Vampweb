import { deepClone } from "./utils.js";

export const PHASE_MESSAGE_KIND = {
  daytimeSettlement: "daytime:settlement",
  nighttimeResult: "nighttime:result",
};

function normalizeResourceMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, amount]) => key && Number.isFinite(Number(amount)))
      .map(([key, amount]) => [key, Math.trunc(Number(amount))])
  );
}

function normalizeMessage(kind, payload = {}) {
  if (!Object.values(PHASE_MESSAGE_KIND).includes(kind)) {
    throw new Error(`Unknown phase message kind: ${kind}`);
  }
  return {
    kind,
    day: Math.max(1, Math.trunc(Number(payload.day) || 1)),
    resources: normalizeResourceMap(payload.resources),
    effects: Array.isArray(payload.effects) ? deepClone(payload.effects) : [],
  };
}

// Phases exchange only serializable DTOs through this adapter, never runtime state or direct imports.
export function createPhaseAdapter() {
  const inbox = new Map();

  function publish(kind, payload) {
    const message = normalizeMessage(kind, payload);
    inbox.set(kind, message);
    return deepClone(message);
  }

  function read(kind) {
    const message = inbox.get(kind);
    return message ? deepClone(message) : null;
  }

  function consume(kind) {
    const message = read(kind);
    inbox.delete(kind);
    return message;
  }

  return {
    publishDaytimeSettlement(payload) {
      return publish(PHASE_MESSAGE_KIND.daytimeSettlement, payload);
    },
    readDaytimeSettlement() {
      return read(PHASE_MESSAGE_KIND.daytimeSettlement);
    },
    publishNighttimeResult(payload) {
      return publish(PHASE_MESSAGE_KIND.nighttimeResult, payload);
    },
    consumeNighttimeResult() {
      return consume(PHASE_MESSAGE_KIND.nighttimeResult);
    },
  };
}
