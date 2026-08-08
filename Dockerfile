# One image intentionally serves both the Next.js web process and the TypeScript worker.
# Compose selects the role with its command; keeping their runtime dependencies identical
# prevents deployment-only drift in database/migration contracts.
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public/catalog-icons \
 && cp catalog/generated/catalog-icons/*.png public/catalog-icons/
RUN npm run build

FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS runtime
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

# GitHub releases pass the verified generated bundle as a named BuildKit context.
# Local runtime builds remain small and continue to use the explicit setup mounts.
FROM runtime AS release
ARG SKYSTORE_RELEASE_VERSION=development
ARG SKYSTORE_RELEASE_REVISION=unknown
LABEL org.opencontainers.image.title="SkyStore" \
      org.opencontainers.image.source="https://github.com/kvoeten/SkyStore" \
      org.opencontainers.image.version=$SKYSTORE_RELEASE_VERSION \
      org.opencontainers.image.revision=$SKYSTORE_RELEASE_REVISION
ENV SKYSTORE_CATALOG_IMPORT_DIR=/opt/skystore/catalog \
    SKYSTORE_ITEM_RENDER_ROOT=/var/lib/skystore/catalog-images/renders
COPY --from=catalog_bundle --chown=skystore:skystore skystore-catalog-current.json skystore-catalog-report.json /opt/skystore/catalog/
COPY --from=catalog_bundle --chown=skystore:skystore item-renders/render-targets.json item-renders/render-report.json item-renders/artwork-manifest.json /opt/skystore/catalog/item-renders/
COPY --from=catalog_bundle --chown=skystore:skystore item-renders/images/ /var/lib/skystore/catalog-images/renders/
