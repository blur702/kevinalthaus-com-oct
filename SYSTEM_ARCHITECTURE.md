# System Architecture Documentation

## Overview

The Kevin Althaus platform is built as a modern, microservices-based architecture designed for scalability, security, and extensibility. This document provides a comprehensive overview of the system architecture, service design patterns, and integration guidelines.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Catalog](#service-catalog)
3. [Database Architecture](#database-architecture)
4. [Security Model](#security-model)
5. [Plugin System](#plugin-system)
6. [Development Environment](#development-environment)
7. [Deployment Strategy](#deployment-strategy)
8. [Monitoring & Observability](#monitoring--observability)

## Architecture Overview

### High-Level Architecture

```text
+-------------------------+    +-----------------------+    +-----------------------+
| Frontend (React)        |    | Admin Panel (React)   |    | Mobile App (Future)   |
| Port 3001               |    | Port 3000             |    |                       |
+-------------------------+    +-----------------------+    +-----------------------+
             \\                        /
              \\                      /
               \\                    /
                v                  v
                +----------------------+
                | API Gateway          |
                | (Express.js)         |
                | Port 4000            |
                +----------------------+
                           |
            +--------------+-----------------------------+
            |                            |               |
 +------------------------+   +-------------------+  +----------------------+
 | Main App (Node.js)     |   | Python Service    |  | Plugin Engine        |
 | Port 3001              |   | Port 8000         |  | Port 3004            |
 +------------------------+   +-------------------+  +----------------------+
            |                            |
            +--------------+-------------+
                           |
      +--------------------+---------------------+    +----------------------+
      | PostgreSQL (Primary DB)                |    | Redis (Caching/Session)|
      | Port 5432                              |    | Port 6379              |
      +----------------------------------------+    +----------------------+
```



### Port Mapping

- Frontend: host 3001 -> container 3000
- Admin Panel: host 3000 -> container 3000
- API Gateway: 4000
- Main App: service 3001 (exposed as 4001:3001)
- Python Service: 8000
- Plugin Engine: 3004
- PostgreSQL: 5432
- Redis: 6379

### Technology Stack

**Frontend Layer:**

- React 18 with TypeScript
- Material UI 5 for component library
- Vite for build tooling
- React Router for navigation

**Backend Services:**

- Node.js with Express.js
- TypeScript for type safety
- FastAPI (Python) for specialized services
- Docker for containerization

**Data Layer:**

- PostgreSQL 16 as primary database
- Redis for caching and sessions
- Plugin-specific schemas for isolation

**Infrastructure:**

- Docker Compose for local development
- Nginx for reverse proxy (production)
- GitHub Actions for CI/CD

## Service Catalog

### API Gateway (`packages/api-gateway`)

**Purpose:** Central entry point for all client requests, handles routing, authentication, and rate limiting.

**Responsibilities:**

- Request routing to appropriate services
- Authentication and authorization
- Rate limiting and throttling
- Request/response transformation
- CORS handling
- Health check aggregation

**Key Endpoints:**

- `GET /health` - Service health status
- `/api/main/*` - Proxy to main application
- `/api/python/*` - Proxy to Python service
- `/api/plugins/*` - Proxy to plugin engine

**Configuration:**

```typescript
const apiGatewayConfig = {
  port: process.env.API_GATEWAY_PORT || 4000,
  mainAppUrl: process.env.MAIN_APP_URL || 'http://localhost:3001',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  pluginEngineUrl: process.env.PLUGIN_ENGINE_URL || 'http://localhost:3004',
};
```

### Main Application (`packages/main-app`)

**Purpose:** Core business logic and primary API endpoints.

**Responsibilities:**

- User management and authentication
- Content management
- Business logic processing
- Database operations
- Plugin coordination

**Key Features:**

- RESTful API design
- Comprehensive error handling
- Request logging and monitoring
- Database migrations
- Plugin lifecycle management

### Python Service (`python/`)

**Purpose:** Specialized services requiring Python's ecosystem (ML, data processing, etc.).

**Responsibilities:**

- Machine learning models
- Data analytics and processing
- Scientific computing tasks
- Integration with Python libraries

**Key Dependencies:**

- FastAPI for web framework
- SQLAlchemy for database ORM
- Pydantic for data validation
- Uvicorn as ASGI server

### Frontend Application (`packages/frontend`)

**Purpose:** Public-facing user interface.

**Key Features:**

- Responsive design
- Server-side rendering ready
- Progressive Web App capabilities
- Optimized bundle sizes
- Accessibility compliance

### Admin Panel (`packages/admin`)

**Purpose:** Administrative interface for system management.

**Key Features:**

- User management
- Content administration
- Plugin management
- System monitoring
- Analytics dashboard

### Shared Package (`packages/shared`)

**Purpose:** Common utilities, types, and interfaces shared across services.

**Key Modules:**

- Database utilities and connections
- Security functions (hashing, validation)
- Plugin system interfaces
- Theme system definitions
- Logging utilities
- Type definitions

## Database Architecture

### Schema Design

```sql
-- Core System Schemas
CREATE SCHEMA IF NOT EXISTS public;          -- Default PostgreSQL schema
CREATE SCHEMA IF NOT EXISTS system;          -- System configuration
CREATE SCHEMA IF NOT EXISTS audit;           -- Audit logging

-- Plugin Schemas (dynamically created)
-- CREATE SCHEMA plugin_<plugin_name>;       -- Per-plugin isolation
```

### Core Tables

```sql
-- Users and Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Plugin Registry
CREATE TABLE plugin_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  version VARCHAR(50) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  author JSONB NOT NULL,
  manifest JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'installed',
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,
  signature VARCHAR(128)
);

-- System Settings
CREATE TABLE system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Plugin Database Isolation

Each plugin receives its own PostgreSQL schema with the naming convention `plugin_<plugin_name>`. This provides:

- **Data Isolation:** Plugins cannot access other plugins' data
- **Resource Quotas:** Configurable limits on storage and connections
- **Schema Management:** Automated migration and versioning
- **Security:** Row-level security policies

### Connection Management

```typescript
// Database connection pooling configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
};
```

## Security Model

### Authentication & Authorization

**Authentication Methods:**

- JWT tokens for API access
- Session-based authentication for web interface
- API keys for service-to-service communication

**Authorization Levels:**

- `admin` - Full system access
- `editor` - Content and user management
- `viewer` - Read-only access
- `guest` - Public content only

### API Gateway and Downstream Service Trust Model

**Critical Security Requirement**: All downstream services (main-app, python-service, plugin-engine) MUST run on a private, trusted network isolated from public access.

**Header Forwarding Architecture:**

The API Gateway acts as the single public-facing entry point and performs JWT authentication. After successful verification, it forwards user context to downstream services via custom headers:

- `X-User-Id`: Authenticated user's unique identifier
- `X-User-Role`: User's role (admin, editor, viewer, etc.)
- `X-User-Email`: User's email address

**Trust Model Requirements:**

1. **Network Isolation**: Downstream services MUST be on a private network unreachable from public internet
2. **No Public Exposure**: Main-app, Python-service, etc. ports (3001, 8000) must NOT be exposed publicly
3. **Gateway-Only Access**: Services trust X-User-* headers ONLY from requests originating from the gateway
4. **No Public Endpoints**: Services should not implement their own authentication for routes behind the gateway

**Security Implications:**

- **If downstream services are publicly accessible**, attackers can forge X-User-* headers to impersonate any user
- **Proper network configuration is mandatory** for this architecture to be secure
- Use Docker networks, VPCs, or firewall rules to enforce isolation
- Consider mutual TLS or shared secrets between gateway and downstream services for additional verification

**Verification Strategy** (Optional Enhancement):

For additional defense-in-depth, downstream services can:
- Verify requests include a shared secret header (e.g., `X-Internal-Token`)
- Check source IP against gateway allowlist
- Implement mutual TLS between gateway and services

**Production Deployment:**

```yaml
# docker-compose.prod.yml example
services:
  api-gateway:
    ports:
      - "4000:4000"  # PUBLIC
    networks:
      - public
      - private

  main-app:
    # NO public ports exposed
    networks:
      - private  # ONLY private network

  python-service:
    # NO public ports exposed
    networks:
      - private  # ONLY private network
```

**Important**: If you need to expose backend services directly (not recommended), they MUST implement their own complete authentication and MUST NOT trust X-User-* headers.

### Plugin Security

**Isolation Mechanisms:**

- Database schema isolation
- Filesystem sandboxing
- Network restrictions
- Resource quotas

**Security Policies:**

```typescript
const defaultIsolationPolicy = {
  allowCrossPluginQueries: false,
  allowSystemSchemaAccess: false,
  maxQueryComplexity: 1000,
  maxExecutionTime: 30000,
  allowedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
};
```

### Input Validation

All user inputs are validated and sanitized using:

- JSON Schema validation
- HTML sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### Secrets Management

**Environment Variables:**

- Database credentials
- API keys
- JWT secrets
- Encryption keys

**Best Practices:**

- Rotate secrets regularly
- Use strong encryption (AES-256)
- Implement secret scanning
- Audit access to sensitive data

## Plugin System

### Plugin Lifecycle

1. **Upload & Validation**
   - Plugin package validation
   - Manifest schema validation
   - Security scanning
   - Dependency verification

2. **Installation**
   - Schema creation
   - Database migrations
   - File system setup
   - Dependency installation

3. **Activation**
   - Service initialization
   - API endpoint registration
   - Theme installation
   - Configuration validation

4. **Runtime**
   - Request handling
   - Background tasks
   - Resource monitoring
   - Error handling

5. **Deactivation**
   - Service shutdown
   - Resource cleanup
   - State preservation

6. **Uninstallation**
   - Data cleanup
   - Schema removal
   - File deletion
   - Dependency cleanup

### Plugin Architecture

```typescript
interface PluginInterface {
  // Lifecycle hooks
  onInstall?(context: PluginExecutionContext): Promise<void>;
  onActivate?(context: PluginExecutionContext): Promise<void>;
  onDeactivate?(context: PluginExecutionContext): Promise<void>;
  onUninstall?(context: PluginExecutionContext): Promise<void>;
  onUpdate?(context: PluginExecutionContext, oldVersion: string): Promise<void>;

  // API handlers
  handleRequest?(context: PluginExecutionContext, request: PluginRequest): Promise<PluginResponse>;

  // Background tasks
  runScheduledTask?(context: PluginExecutionContext, task: ScheduledTask): Promise<void>;
}
```

## Development Environment

### Local Development Setup

```bash
# Clone repository
git clone <repository-url>
cd kevinalthaus-com-oct

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start services
docker-compose up -d postgres redis
npm run dev:all

# Run tests
npm test
```

### Service Development

**Starting Individual Services:**

```bash
# API Gateway
cd packages/api-gateway && npm run dev

# Main App
cd packages/main-app && npm run dev

# Frontend
cd packages/frontend && npm run dev

# Admin Panel
cd packages/admin && npm run dev

# Python Service
cd python && uvicorn main:app --reload
```

### Plugin Development

```bash
# Create new plugin
mkdir plugins/my-plugin
cd plugins/my-plugin

# Initialize plugin
npm init -y
# Create plugin.yaml and src/index.ts

# Install plugin dependencies
npm install @monorepo/shared

# Build and test
npm run build
npm test
```

## Deployment Strategy

### Production Environment

**Container Orchestration:**

- Docker Swarm or Kubernetes
- Load balancing with Nginx
- SSL termination
- Auto-scaling based on metrics

**Infrastructure Components:**

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ['80:80', '443:443']
    volumes: ['./nginx.conf:/etc/nginx/nginx.conf']

  api-gateway:
    image: kevinalthaus/api-gateway:latest
    replicas: 3
    environment: ['NODE_ENV=production']

  main-app:
    image: kevinalthaus/main-app:latest
    replicas: 3
    environment: ['NODE_ENV=production']

  postgres:
    image: postgres:16-alpine
    environment: ['POSTGRES_DB=kevinalthaus_prod']
    volumes: ['postgres_data:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    volumes: ['redis_data:/data']
```

### CI/CD Pipeline

**GitHub Actions Workflow:**

1. Code quality checks (ESLint, Prettier)
2. Security scanning
3. Unit and integration tests
4. Build Docker images
5. Push to registry
6. Deploy to staging
7. Run E2E tests
8. Deploy to production

### Health Checks

Each service implements health check endpoints:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'service-name',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || '1.0.0',
    uptime: process.uptime(),
  });
});
```

## Monitoring & Observability

### Logging Strategy

**Log Levels:**

- DEBUG: Detailed information for debugging
- INFO: General information about system operation
- WARN: Warning messages about potential issues
- ERROR: Error messages for actual problems

**Log Format:**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "api-gateway",
  "message": "Request processed successfully",
  "context": {
    "requestId": "req-123",
    "userId": "user-456",
    "endpoint": "/api/users",
    "duration": 150
  }
}
```

### Metrics Collection

**Application Metrics:**

- Request rate and response time
- Error rates and types
- Database query performance
- Plugin performance metrics

**System Metrics:**

- CPU and memory usage
- Disk space and I/O
- Network traffic
- Container health

### Error Handling

**Global Error Handling:**

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = generateErrorId();

  logger.error('Unhandled error', err, {
    errorId,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
  });

  // Only expose detailed error information in strict local development
  const isLocalDev =
    process.env.NODE_ENV === 'development' && (process.env.DEPLOY_ENV ?? 'local') === 'local';

  const body: Record<string, unknown> = {
    error: 'Internal Server Error',
    errorId,
  };

  if (isLocalDev) {
    body.message = err.message || 'Unknown error';
    body.stack = err.stack;
  }

  res.status(500).json(body);
});
```

### Performance Monitoring

**Key Performance Indicators:**

- API response times (p50, p95, p99)
- Database query performance
- Plugin execution times
- Frontend load times
- Error rates by service

**Alerting Thresholds:**

- API response time > 2000ms
- Error rate > 5%
- Database connection pool exhaustion
- Plugin memory usage > 512MB
- Disk usage > 80%

---

This architecture is designed to be scalable, maintainable, and secure while providing a robust foundation for plugin development and system extension. For specific implementation details, refer to the individual service documentation and the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md).

