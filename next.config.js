/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

import withSerwistInit from "@serwist/next";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
};

/**
 * PWA (NFR-4). `@serwist/next` compiles `src/app/sw.ts` into `public/sw.js` during the
 * build; the Dockerfile already copies `public/` into the standalone output, so the worker
 * ships without any change there.
 *
 * Disabled in development: a service worker caching a dev server makes every HMR update a
 * coin flip, and the dev server is already the least trustworthy thing in this project.
 */
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(config);
