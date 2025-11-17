# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/main-app/package*.json ./packages/main-app/

# Copy plugin package.json files for dependency resolution
COPY plugins ./plugins

# Install dependencies (including devDependencies for build and ALL plugin dependencies)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/main-app ./packages/main-app

# Copy config directory (required by runtime configuration)
COPY config ./config

# Build @monorepo/shared first (required by plugins)
RUN npx lerna run build --scope=@monorepo/shared

# Build plugins (now that shared is available)
# Build taxonomy first as it's a dependency for content-manager
RUN cd plugins/taxonomy && npm run build && cd ../..
RUN cd plugins/page-builder && npm run build && cd ../..
RUN cd plugins/file-manager && npm run build && cd ../..
RUN cd plugins/content-manager && npm run build && cd ../..
RUN cd plugins/user-manager && npm run build && cd ../..

# Build main-app (now that plugins are available)
RUN npx lerna run build --scope=@monorepo/main-app --include-dependencies

# Production stage
FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create a non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Set working directory
WORKDIR /app

# Copy package files for production install
COPY package*.json ./
COPY lerna.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/main-app/package*.json ./packages/main-app/

# Copy plugins for dependency resolution
COPY --from=builder /app/plugins ./plugins

# Install only production dependencies (includes plugin dependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/main-app/dist ./packages/main-app/dist
COPY --from=builder /app/packages/main-app/package.json ./packages/main-app/

# Copy config directory (required by runtime configuration)
COPY --from=builder /app/config ./config

# Copy SQL migration files (needed at runtime)
# Copy entire migrations directory to allow empty directory (avoids wildcard match failure)
COPY --from=builder /app/packages/main-app/src/db/migrations ./packages/main-app/dist/db/migrations

# Create all required directories with proper ownership from the start
RUN mkdir -p /app/uploads \
             /app/packages/main-app/uploads \
             /app/packages/main-app/uploads_quarantine \
             /app/storage/.cache/transforms && \
    chown -R appuser:appuser /app/uploads \
                              /app/packages/main-app/uploads \
                              /app/packages/main-app/uploads_quarantine \
                              /app/storage \
                              /app/packages/main-app/dist

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "packages/main-app/dist/server.js"]
