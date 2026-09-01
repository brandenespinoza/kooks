/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

/**
 * Service worker source (NFR-4). Compiled by `@serwist/next` into `public/sw.js` at build
 * time — it is not a route, and nothing imports it.
 *
 * Excluded from `tsconfig.json`: the file needs the WebWorker lib, which collides with the
 * DOM lib the rest of the app compiles against. `npm run typecheck` therefore does not cover
 * this file; the build still compiles it.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const apiCache: RuntimeCaching[] = [
  {
    /**
     * The presence stream is never cached — and this rule exists to *prevent* caching, not
     * to configure it. An SSE response never completes, so a caching strategy would either
     * hold the connection open forever waiting to store it or replay a truncated stream on
     * reconnect. The AC asks for network-first here; network-first on an infinite response
     * is not a thing that works.
     */
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname === "/api/presence/stream",
    handler: new NetworkOnly(),
  },
  {
    /**
     * tRPC queries: network-first, with the last good response as the fallback so a cold
     * tunnel or a dead spot in the car park shows yesterday's crew list rather than an
     * error. GET only — `httpBatchStreamLink` sends queries as GET and mutations as POST,
     * and a replayed mutation would check someone in twice.
     */
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin &&
      request.method === "GET" &&
      url.pathname.startsWith("/api/trpc"),
    handler: new NetworkFirst({
      cacheName: "kooks-trpc",
      networkTimeoutSeconds: 5,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Order matters: the API rules are checked before Serwist's Next.js defaults, which
  // otherwise claim same-origin requests generically.
  runtimeCaching: [...apiCache, ...defaultCache],
});

serwist.addEventListeners();

/**
 * FR-18. Renders an incoming push.
 *
 * `event.waitUntil` is not optional: without it the worker can be killed before the
 * notification is shown, and the browser then displays its own "This site has been updated
 * in the background" placeholder instead — which is worse than showing nothing.
 *
 * A malformed or bodiless payload is ignored rather than shown as an empty notification.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    return;
  }

  if (!payload.title) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // `tag` collapses repeats: a second check-in from the same person replaces the first
      // on the lock screen rather than stacking.
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

/**
 * Tapping a notification focuses the app if it is already open, rather than opening a second
 * copy — an installed PWA with two windows is a confusing thing to hand someone at 5am.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string } | null)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
