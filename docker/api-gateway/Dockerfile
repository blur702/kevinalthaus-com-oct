# Builder stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api-gateway/package*.json ./packages/api-gateway/

# Install all dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api-gateway ./packages/api-gateway

# Build packages (only what api-gateway needs)
RUN npx lerna run build --scope=@monorepo/shared --scope=@monorepo/api-gateway --include-dependencies

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
COPY tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api-gateway/package*.json ./packages/api-gateway/

# Copy built artifacts from builder stage BEFORE npm install
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist
COPY --from=builder /app/packages/api-gateway/package.json ./packages/api-gateway/

# Install only production dependencies (this will create proper symlinks to packages/shared)
RUN npm ci --omit=dev && npm cache clean --force

# Switch to non-root user for security (avoid running as root)
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "packages/api-gateway/dist/server.js"]
