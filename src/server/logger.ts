import "server-only";

import { pino } from "pino";

import { env } from "~/env";

/**
 * The single structured logger. Scheduled jobs run with no request to attach to and no one
 * watching a browser console, so their output has to be legible in `docker logs` months later
 * — that is what architecture.md's logging rule is for, and Story 3.1 is the first code that
 * genuinely needs it.
 *
 * Default stdout destination, no transport worker: pino's pretty/file transports spawn a
 * worker thread whose module Next.js standalone output does not trace, which turns into a
 * crash at container start. The container's log driver does the formatting instead.
 *
 * `base: undefined` drops pid/hostname — a single-instance deploy has exactly one of each.
 *
 * React components and tRPC procedures still use `console`; this is not a call to convert
 * them.
 */
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  base: undefined,
});
