import { NextResponse, type NextRequest } from "next/server";

/**
 * Session cookie name, inlined deliberately.
 *
 * Middleware runs on the Edge Runtime, which cannot reach Prisma or `~/env` — importing
 * `~/server/auth/session` here would pull both in and fail at build time. This is the same
 * Edge constraint recorded for `src/server/events.ts` in deferred-work.md.
 */
const SESSION_COOKIE_NAME = "kooks-session";

/**
 * Presence check only. A forged or expired cookie gets past this and is rejected by
 * `protectedProcedure`, which validates the token against the database. Middleware exists
 * to keep unauthenticated visitors off app routes and away from any sign-up affordance
 * (FR-22) — it is not the authorization boundary.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/join-required";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Everything except: tRPC and other API routes (they enforce their own auth and must be
   * able to return 401 rather than a redirect), Next.js internals, PWA assets, and the
   * unauthenticated entry points `/join/*` and `/join-required`.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|join|join-required).*)",
  ],
};
