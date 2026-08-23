FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install --workspaces --include-workspace-root

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# The Prisma client now lives in a workspace package that webpack treats as
# external, so node_modules/@storycanon/db is a symlink that only resolves if
# the package itself is in the image.
COPY --from=builder --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
# Prisma 7 reads the Migrate connection URL from prisma.config.ts, so the
# deploy pipeline's one-off `prisma migrate deploy` task needs it in the image.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma.config.ts ./apps/web/prisma.config.ts
# Deliberately the whole tree, devDependencies included: the deploy pipeline's
# migration task runs the Prisma CLI from this image, and that pulls in prisma,
# dotenv, and the jiti/c12 pair that loads prisma.config.ts. Adding --omit=dev
# or `npm prune --production` to shrink the image would break that step.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
USER nextjs
EXPOSE 3000
ENV PORT=3000
# Serving only. Migrations used to run here, which meant they fired on every
# task start — including the green task of a blue/green deploy, while blue was
# still serving the old code against the schema being changed. The deploy
# pipeline now applies them once, as an explicit gated step, using this same
# image with a command override (see scripts/deploy-bluegreen.sh).
CMD ["node", "apps/web/server.js"]
