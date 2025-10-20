FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create a non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/api-gateway/package*.json ./packages/api-gateway/

# Install dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/api-gateway ./packages/api-gateway

# Build packages
RUN npm run build

# Set ownership and switch to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "packages/api-gateway/dist/index.js"]
