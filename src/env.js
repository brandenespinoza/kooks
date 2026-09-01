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
    SESSION_SECRET: z.string().min(32),
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
    SESSION_SECRET: process.env.SESSION_SECRET,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
