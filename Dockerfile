FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# package.json's postinstall is `prisma generate`, which needs the schema present.
# Without this COPY, `npm ci` fails here with "Could not find Prisma Schema".
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The `prisma` CLI is needed at container start for `migrate deploy`, but Next.js standalone
# only traces what the app imports at runtime — it does not trace the CLI. Do NOT try to
# cherry-pick @prisma/* packages here: the CLI's tree spans @prisma/{debug,config,get-platform,
# fetch-engine,engines-version} plus third-party deps, and every omission surfaces as a
# MODULE_NOT_FOUND crash loop at boot. Give it a real node_modules in its own directory and
# point the CLI at it, leaving the standalone server's traced node_modules untouched.
COPY --from=deps /app/node_modules ./cli/node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./cli/package.json
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Run migrations (from the CLI's own dependency tree) then start the standalone server
CMD ["sh", "-c", "node cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
