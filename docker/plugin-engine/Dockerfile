FROM node:22-alpine AS builder

RUN apk add --no-cache curl
WORKDIR /app

# Copy full workspace for reliable dependency installation and build
COPY . .

# Install all deps including devDependencies for build
RUN npm ci && npm cache clean --force

# Build only the plugin-engine workspace
RUN npm run build --workspace @monorepo/plugin-engine

FROM node:22-alpine AS runtime

RUN addgroup -g 1001 -S appuser \
  && adduser -S appuser -u 1001 -G appuser \
  && apk add --no-cache curl

WORKDIR /app

# Copy package manifest to install production deps
COPY packages/plugin-engine/package.json ./packages/plugin-engine/package.json

WORKDIR /app/packages/plugin-engine

# Install only production dependencies for the plugin engine package
RUN npm install --omit=dev && npm cache clean --force

# Copy built artifacts from builder image
COPY --from=builder /app/packages/plugin-engine/dist ./dist

USER appuser

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

CMD ["node", "dist/server.js"]
