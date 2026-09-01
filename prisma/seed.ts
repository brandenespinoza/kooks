/**
 * Creates the primary user so the very first invite link works on a fresh deployment.
 *
 * Instantiates PrismaClient directly rather than importing `~/server/db`. Enforcement rule 3
 * forbids that in application code, but this script runs outside the Next.js runtime where
 * neither the `~` path alias nor `~/env` validation are available. Documented exception —
 * see _bmad-output/implementation-artifacts/deferred-work.md.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const inviteToken = process.env.SEED_INVITE_TOKEN?.trim();

  if (!inviteToken) {
    throw new Error(
      "SEED_INVITE_TOKEN is not set. Add it to .env — it becomes the primary user's invite link."
    );
  }

  const displayName = process.env.SEED_DISPLAY_NAME?.trim() ?? "Reef";

  // Idempotent: re-running never creates a second primary user or rotates the token.
  const user = await db.user.upsert({
    where: { inviteToken },
    update: {},
    create: {
      displayName,
      inviteToken,
      notificationPrefs: { create: {} },
    },
    select: { id: true, displayName: true },
  });

  // Back-fill prefs for a user seeded before NotificationPref existed.
  await db.notificationPref.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log(
    `Seeded primary user "${user.displayName}" (${user.id}).\n` +
      `Invite link: /join/${inviteToken}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
