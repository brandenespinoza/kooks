import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";

import { api } from "~/trpc/server";
import { PasskeySetup } from "~/components/PasskeySetup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kooks — Set up a passkey",
};

/**
 * The far side of the enrolment gate.
 *
 * This page deliberately does **not** apply the gate itself. `/` and `/settings` send people
 * here when `hasPasskey` is false; if this page did the same it would redirect to itself
 * forever. It does the inverse — someone who already has a passkey has no business here and
 * is sent home.
 */
export default async function PasskeySetupPage() {
  let me;

  try {
    me = await api.crew.me();
  } catch (error) {
    // Same distinction the other guarded pages draw: only a real auth failure means "not
    // signed in". A database outage must surface as an error, not bounce someone to the
    // invite wall.
    if (error instanceof TRPCError && error.code === "UNAUTHORIZED") {
      redirect("/join-required");
    }
    throw error;
  }

  if (me.hasPasskey) redirect("/");

  return <PasskeySetup displayName={me.displayName} />;
}
