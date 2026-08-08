# One image intentionally serves both the Next.js web process and the TypeScript worker.
# Compose selects the role with its command; keeping their runtime dependencies identical
# prevents deployment-only drift in database/migration contracts.
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public/catalog-icons \
 && cp catalog/generated/catalog-icons/*.png public/catalog-icons/
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 skystore \
 && adduser --system --uid 1001 --ingroup skystore skystore \
 && mkdir -p /var/lib/skystore/uploads /var/lib/skystore/catalog-images /var/lib/skystore/catalog-import /var/lib/skystore/backups \
 && chown -R skystore:skystore /app /var/lib/skystore
COPY --from=build --chown=skystore:skystore /app/.next/standalone ./
COPY --from=build --chown=skystore:skystore /app/.next/static ./.next/static
COPY --from=build --chown=skystore:skystore /app/public ./public
# The worker and Drizzle migration command share this image. They need source, schema,
# config and the build-stage toolchain; the web process uses only the standalone bundle.
COPY --from=build --chown=skystore:skystore /app/src ./src
COPY --from=build --chown=skystore:skystore /app/drizzle ./drizzle
COPY --from=build --chown=skystore:skystore /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=skystore:skystore /app/tsconfig.json ./tsconfig.json
COPY --from=dependencies --chown=skystore:skystore /app/node_modules ./node_modules
USER skystore
EXPOSE 3000
CMD ["node", "server.js"]
