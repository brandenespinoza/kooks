import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";
import { SettingsScreen } from "~/components/SettingsScreen";

export const dynamic = "force-dynamic";

/**
 * FR-17. Everything that is not the Break screen.
 *
 * Same guard as `/`: middleware only proves a cookie exists, so the session is validated
 * here by the procedure that actually checks it against the database, and only a genuine
 * auth failure bounces the user to the invite wall.
 */
export default async function SettingsPage() {
  try {
    await api.crew.me();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      redirect("/join-required");
    }
    throw error;
  }

  return <SettingsScreen />;
}
