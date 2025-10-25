# System Architecture

## Overview

The platform uses a microservices architecture designed for scalability, security, and extensibility.

## Services and Ports

- API Gateway: host mapped (4000:3000 in prod, 3000:3000 in dev) - external access point
- Main App: internal only (3001, no host port in prod) - accessed via API Gateway
- Frontend: host mapped (3002:3000 in prod) - serves static assets
- Admin: host mapped (3003:3000 in prod) - serves admin UI
- Plugin Engine: internal only (3004, no host port in prod) - accessed via API Gateway
- Python Service: internal only (8000, no host port in prod) - accessed via API Gateway
- PostgreSQL: internal only (5432, no host port in prod)
- Redis: internal only (6379, no host port in prod)

**Note:** In production, external access to backend services should route through the API Gateway (port 4000) unless a service has an explicit host mapping listed above. Internal services communicate directly using container networking.

## High-Level Diagram

```text
Client -> API Gateway (:3000 dev / :4000 prod)
            |
            +--> Main App (:3001) -> PostgreSQL (:5432), Redis (:6379)
            +--> Python Service (:8000)
Frontend (:3002) / Admin (:3003) -> API Gateway
```

## Technology Stack

- Frontend: React 18, TypeScript, Vite, Material UI
- Admin: React 18, TypeScript, Vite, Material UI
- API Gateway: Node.js, Express
- Main App: Node.js, Express, TypeScript
- Python Service: FastAPI, SQLAlchemy, Uvicorn
- Data: PostgreSQL 16 (primary), Redis (cache/session)
- Infra: Docker Compose (local), Nginx (prod), GitHub Actions (CI/CD)

## Configuration (examples)

```ts
// API Gateway essentials
const apiGatewayConfig = {
  port: Number(process.env.API_GATEWAY_PORT || process.env.PORT || 3000),
  mainAppUrl: process.env.MAIN_APP_URL || 'http://localhost:3001',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  pluginEngineUrl: process.env.PLUGIN_ENGINE_URL || 'http://localhost:3004',
};
```

## Security Model

- JWT-based auth; role-based access control
- Gateway verifies JWT and forwards user context to internal services
- Internal services are not exposed publicly in production
- CORS configured via environment allowlists for dev

See `docs/security.md` for details.

