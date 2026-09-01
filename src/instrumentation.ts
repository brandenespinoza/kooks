/**
 * Next.js server-boot hook (enforcement rule 13) — the only place pg-boss is initialised.
 * A route handler or component would re-run per request and re-register the cron jobs.
 */
export async function register() {
  // Next compiles this file for the Edge runtime as well, where pg-boss's `pg` dependency
  // cannot resolve `fs`/`net` and the build fails. The import has to sit *inside* the
  // runtime check: webpack folds `process.env.NEXT_RUNTIME` at build time and drops the
  // whole branch, but only for a wrapping `if` — an early `return` still leaves the import
  // as a live dependency of the Edge bundle. This is the shape Next's own docs use.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // `next build` runs this too, while collecting page data, with a placeholder
    // DATABASE_URL. Nothing should open a Postgres connection during a build.
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const { startJobs } = await import("~/server/jobs");
    await startJobs();
  }
}
