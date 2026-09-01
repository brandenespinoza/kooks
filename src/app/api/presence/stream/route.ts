import { db } from "~/server/db";
import { emitter, PRESENCE_EVENT_TYPES, type PresenceEvent } from "~/server/events";
import { logger } from "~/server/logger";
import { getSessionFromHeaders } from "~/server/auth/session";
import {
  listCrewUserIds,
  listVisibleBreakIds,
} from "~/server/auth/assert-crew-member";

/** Rule 11 — without this the route is statically optimised and the stream never opens. */
export const dynamic = "force-dynamic";
/** `EventEmitter` does not exist on the Edge runtime. */
export const runtime = "nodejs";

/**
 * Proxies (Nginx Proxy Manager, in this deployment) drop idle upstream connections. A
 * comment line is a valid no-op SSE frame and keeps the pipe warm.
 */
const HEARTBEAT_MS = 25_000;

/**
 * Presence stream (FR-11, NFR-2). SSE carries the *signal*; tRPC carries the data — a client
 * that receives an event invalidates `break.list` and refetches through the authorized
 * procedure it already uses. Nothing about a Break travels down this pipe except its id.
 *
 * **One connection per client, not per Break screen.** The AC describes `BreakScreen` opening
 * `?breakId=[id]`, but every panel in the swipe stack is mounted at once, so that reading
 * means N long-lived connections against a browser's ~6-per-origin cap. The stream is scoped
 * to every Break the caller can see instead, which is the same rule moved up one level —
 * exactly what happened to the tRPC caller in Story 2.3.
 *
 * **Crew-scoped now, not in Epic 5.** The AC allows a cookie-presence check because
 * `assertCrewMember` was meant to be a stub through Epic 4. It has been real since Story 1.3
 * (replan correction 1), so events are filtered to the caller's visible Breaks here.
 */
export async function GET(request: Request) {
  const session = await getSessionFromHeaders(request.headers);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [visibleIds, crewIds] = await Promise.all([
    listVisibleBreakIds(db, session.userId),
    listCrewUserIds(db, session.userId),
  ]);
  const visible = new Set(visibleIds);
  // NFR-7. Break visibility is not presence visibility: two people can share a Break
  // without sharing a crew connection, and a check-in must not cross that line.
  const crew = new Set(crewIds);
  const encoder = new TextEncoder();

  let cleanup = () => {
    /* replaced in start() */
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client vanished between the check and the write. Nothing to salvage —
          // stop listening rather than throwing inside an emitter callback.
          cleanup();
        }
      };

      const send = (event: PresenceEvent) => {
        write(
          `data: ${JSON.stringify({ type: event.type, breakId: event.breakId })}\n\n`,
        );
      };

      const refresh = async () => {
        const [ids, crewMembers] = await Promise.all([
          listVisibleBreakIds(db, session.userId),
          listCrewUserIds(db, session.userId),
        ]);
        // Rebuilt rather than added to, so access that has been *lost* (a Break deleted or
        // unsaved) stops being forwarded on a long-lived connection too.
        visible.clear();
        for (const id of ids) visible.add(id);
        crew.clear();
        for (const id of crewMembers) crew.add(id);
      };

      const onEvent = (event: PresenceEvent) => {
        // A crew change is about two people, not a place. It reaches only the two of them,
        // and it changes what they can see in either direction — so both sets are rebuilt
        // before the client is told to refetch. Removal narrows; joining widens.
        if (event.type === "crew.joined" || event.type === "crew.removed") {
          if (!involves(event.payload, session.userId)) return;
          void (async () => {
            try {
              await refresh();
              send(event);
            } catch (error) {
              logger.error(
                { err: error, userId: session.userId },
                "presence stream: could not refresh after a crew change",
              );
            }
          })();
          return;
        }

        if (event.breakId === null) return;

        // NFR-7. A check-in belongs to a person: sharing the Break is not enough, the
        // viewer must share a crew connection with whoever checked in.
        if (event.type.startsWith("checkIn.") && !actorInCrew(event.payload, crew)) {
          return;
        }

        if (visible.has(event.breakId)) {
          send(event);
          return;
        }

        // A Break created *after* this connection opened cannot be in a set resolved at
        // connect time — which would make `break.created` an event nobody ever receives.
        // Re-resolving only on that miss keeps every check-in event on the Set lookup.
        if (event.type !== "break.created") return;

        void (async () => {
          try {
            await refresh();
            if (event.breakId !== null && visible.has(event.breakId)) send(event);
          } catch (error) {
            logger.error(
              { err: error, userId: session.userId },
              "presence stream: could not refresh visible breaks",
            );
          }
        })();
      };

      for (const type of PRESENCE_EVENT_TYPES) emitter.on(type, onEvent);
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const type of PRESENCE_EVENT_TYPES) emitter.off(type, onEvent);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime; the listeners are what mattered.
        }
      };

      // An open comment flushes headers immediately, so `EventSource.onopen` fires without
      // waiting for the first real event.
      write(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  // `cancel` does not fire for every disconnect path; the request signal does.
  request.signal.addEventListener("abort", () => cleanup());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx buffers proxied responses by default, which would hold events until the
      // buffer fills. Without this the 5-second requirement (NFR-2) fails in production
      // while passing locally.
      "X-Accel-Buffering": "no",
    },
  });
}

/** `crew.joined` carries the two users it connected. */
function involves(payload: Record<string, unknown>, userId: string): boolean {
  const ids = payload.userIds;
  return Array.isArray(ids) && ids.includes(userId);
}

/**
 * Every check-in event carries the id of whoever checked in — including the ones the expiry
 * sweep emits. An event without one is dropped rather than forwarded on the assumption that
 * it is safe.
 */
function actorInCrew(payload: Record<string, unknown>, crew: Set<string>): boolean {
  return typeof payload.userId === "string" && crew.has(payload.userId);
}
