import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { BreakSwipeStack } from "~/components/BreakSwipeStack";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    // Middleware only proves a cookie exists. A stale or forged one reaches this point and
    // is rejected here, by the procedure that actually validates it against the database.
    await api.crew.me();
  } catch (error) {
    // Only a genuine auth failure means "not signed in". Anything else — a database
    // outage, most likely — must surface as an error rather than masquerading as a
    // logged-out user and quietly bouncing someone to the invite wall.
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      redirect("/join-required");
    }
    throw error;
  }

  return <BreakSwipeStack />;
}
