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

# Install dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/main-app ./packages/main-app

# Build packages
RUN npm run build

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

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/main-app/dist ./packages/main-app/dist
COPY --from=builder /app/packages/main-app/package.json ./packages/main-app/

# Create upload directory and set ownership
RUN mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "packages/main-app/dist/server.js"]
