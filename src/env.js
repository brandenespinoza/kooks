import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SEED_INVITE_TOKEN: z.string().min(1),
    SWELLCLOUD_API_KEY: z.string().min(1),
    // Which conditions source the poll job reads. "mock" generates plausible synthetic
    // data locally and never calls out — see src/lib/swellcloud.ts. Defaults to the real
    // API so a production deploy cannot serve fake surf conditions by omission.
    CONDITIONS_SOURCE: z.enum(["swellcloud", "mock"]).default("swellcloud"),
    // The crew's timezone. pg-boss schedules in UTC, but "9pm" and "5am" are local facts
    // about when people go to bed and get up — and the offset moves twice a year.
    APP_TIMEZONE: z.string().min(1).default("America/New_York"),
    OPENAI_API_KEY: z.string().min(1),
    WEBCAM_URLS_JSON: z
      .string()
      .default("{}")
      .refine((s) => {
        try {
          JSON.parse(s);
          return true;
        } catch {
          return false;
        }
      }, "WEBCAM_URLS_JSON must be valid JSON"),
    WEB_PUSH_PUBLIC_KEY: z.string().min(1),
    WEB_PUSH_PRIVATE_KEY: z.string().min(1),
    WEB_PUSH_EMAIL: z.string().startsWith("mailto:", "WEB_PUSH_EMAIL must start with mailto:"),
    // WebAuthn relying-party identity.
    //
    // RP_ID is the bare domain a passkey is scoped to — no scheme, no port ("localhost" in
    // dev, the Caddy domain in production). The platform binds every credential to this
    // value, so changing it silently invalidates every passkey already registered and
    // locks out everyone who has no other device. Treat it as permanent.
    PASSKEY_RP_ID: z.string().min(1),
    // Full origin(s) a ceremony may run on, comma-separated. Scheme and any non-default
    // port included ("http://localhost:3000"). An installed PWA reports the same origin as
    // the browser it was installed from, so one entry covers both.
    //
    // Neither of these gets a default: there is no value that is safe to guess, and a wrong
    // RP ID fails at the authenticator with an opaque browser error rather than at boot.
    PASSKEY_ORIGIN: z.string().min(1),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SEED_INVITE_TOKEN: process.env.SEED_INVITE_TOKEN,
    SWELLCLOUD_API_KEY: process.env.SWELLCLOUD_API_KEY,
    CONDITIONS_SOURCE: process.env.CONDITIONS_SOURCE,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    WEBCAM_URLS_JSON: process.env.WEBCAM_URLS_JSON,
    WEB_PUSH_PUBLIC_KEY: process.env.WEB_PUSH_PUBLIC_KEY,
    WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
    WEB_PUSH_EMAIL: process.env.WEB_PUSH_EMAIL,
    PASSKEY_RP_ID: process.env.PASSKEY_RP_ID,
    PASSKEY_ORIGIN: process.env.PASSKEY_ORIGIN,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
