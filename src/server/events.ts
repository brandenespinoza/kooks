import { EventEmitter } from "events";

/**
 * Every event the SSE route subscribes to. An array rather than only a union, because the
 * stream has to register a listener per name and a hand-maintained second list would drift.
 */
export const PRESENCE_EVENT_TYPES = [
  "checkIn.created",
  "checkIn.updated",
  "checkIn.removed",
  "break.created",
  "break.deleted",
  "crew.joined",
  "crew.removed",
] as const;

export type PresenceEvent = {
  type: (typeof PRESENCE_EVENT_TYPES)[number];
  /**
   * Null for `crew.joined` and `crew.removed`, which are about two people rather than a
   * place. Every other
   * event names the Break whose screen has to change.
   */
  breakId: string | null;
  payload: Record<string, unknown>;
};

const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

export const emitter = globalForEmitter.emitter ?? new EventEmitter();
emitter.setMaxListeners(100);

// Persist across hot reloads in all environments (dev and production alike)
globalForEmitter.emitter = emitter;
