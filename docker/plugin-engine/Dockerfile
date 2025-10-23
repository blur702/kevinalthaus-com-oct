FROM node:22-alpine

RUN addgroup -g 1001 -S appuser \
  && adduser -S appuser -u 1001 -G appuser \
  && apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
COPY lerna.json ./
COPY tsconfig.json ./
COPY packages/plugin-engine/package*.json ./packages/plugin-engine/

# install minimal deps for this package
RUN npm ci --omit=dev && npm cache clean --force || true

# Copy source
COPY packages/plugin-engine ./packages/plugin-engine

# Build
RUN npm run --workspace @monorepo/plugin-engine build

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

CMD ["node", "packages/plugin-engine/dist/server.js"]

