# Builder stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/admin/package*.json ./packages/admin/

# Install all dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/admin ./packages/admin
COPY plugins ./plugins
COPY config ./config

# Copy root public directory (required by admin vite.config.ts publicDir setting)
COPY public ./public

# Build packages (test files are excluded via tsconfig.json exclude rules)
RUN npx lerna run build --scope=@monorepo/shared --scope=@monorepo/admin --include-dependencies

# Production stage - serve static files with nginx
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx config
COPY docker/admin/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/packages/admin/dist /usr/share/nginx/html

# Expose port 3000 (nginx will listen on this)
EXPOSE 3000

# Health check using curl
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl --fail --silent --show-error --max-time 10 http://localhost:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
