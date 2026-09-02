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
  let me;

  try {
    me = await api.crew.me();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      redirect("/join-required");
    }
    throw error;
  }

  // The mandatory passkey gate. Here rather than in middleware because middleware runs on
  // the Edge Runtime and cannot reach Prisma (enforcement rule 15) — and `crew.me` is
  // already being called as the auth guard, so this costs no extra round trip.
  if (!me.hasPasskey) redirect("/passkey-setup");

  return <SettingsScreen />;
}
