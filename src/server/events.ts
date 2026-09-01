import { EventEmitter } from "events";

export type PresenceEvent = {
  type:
    | "checkIn.created"
    | "checkIn.updated"
    | "checkIn.removed"
    | "break.created"
    | "break.deleted";
  breakId: string;
  payload: Record<string, unknown>;
};

const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

export const emitter = globalForEmitter.emitter ?? new EventEmitter();
emitter.setMaxListeners(100);

// Persist across hot reloads in all environments (dev and production alike)
globalForEmitter.emitter = emitter;
