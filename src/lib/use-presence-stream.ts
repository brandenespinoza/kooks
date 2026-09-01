"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to `/api/presence/stream` for the lifetime of the calling component (FR-11).
 *
 * The event carries a signal, never data: `onEvent` is expected to invalidate a TanStack
 * Query cache so the refetch goes back through the authorized tRPC procedure. That is why
 * nothing here inspects the payload.
 *
 * `EventSource` reconnects on its own when the connection drops (a proxy timeout, a phone
 * waking up), so there is no retry logic to write. The connection is opened once and closed
 * on unmount — `onEvent` is held in a ref precisely so that a new callback identity on every
 * render does not tear down and re-establish the stream.
 */
export function usePresenceStream(onEvent: () => void) {
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const source = new EventSource("/api/presence/stream");

    // Events are not replayed (no Last-Event-ID on this stream), so anything emitted while
    // the connection was down is simply missed. Treating "the stream opened" as an event
    // makes every reconnect self-healing: the client refetches and is correct again.
    source.onopen = () => {
      handler.current();
    };

    source.onmessage = () => {
      handler.current();
    };

    return () => source.close();
  }, []);
}
