import { redirect } from "next/navigation";

import { api } from "~/trpc/server";
import { BreakScreen } from "~/components/BreakScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    // Middleware only proves a cookie exists. A stale or forged one reaches this point and
    // is rejected here, by the procedure that actually validates it against the database.
    await api.crew.me();
  } catch {
    redirect("/join-required");
  }

  return <BreakScreen />;
}
