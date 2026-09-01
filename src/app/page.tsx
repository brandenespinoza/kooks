import { redirect } from "next/navigation";

import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

/**
 * Placeholder home screen. Epic 2 replaces this with the Break swipe stack.
 *
 * For now it does one useful thing: prove the session cookie resolves to a real user
 * through the RSC tRPC caller (Story 1.3, AC 4).
 */
export default async function Home() {
  let user: Awaited<ReturnType<typeof api.crew.me>>;

  try {
    user = await api.crew.me();
  } catch {
    // Middleware only checks that a cookie exists. A stale or forged token gets this far
    // and is rejected here, by the procedure that actually validates it against the DB.
    redirect("/join-required");
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-7">
      <p className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        Signed in
      </p>

      <h1 className="mt-2 text-[28px] font-bold leading-[1.18] tracking-tight text-text-primary">
        You&rsquo;re in, {user.displayName}.
      </h1>

      <p className="mt-4 text-[13px] text-text-secondary">
        Your breaks show up here once Epic 2 lands.
      </p>
    </main>
  );
}
