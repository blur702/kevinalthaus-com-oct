# Kevin Althaus Platform

A modern, extensible web platform built with React, TypeScript, and Node.js featuring a powerful plugin architecture.

## 🚀 Features

- **Microservices Architecture** - Scalable, containerized services
- **Plugin System** - Extensible architecture with isolated plugin execution
- **Modern Frontend** - React 18 with Material UI and TypeScript
- **Admin Dashboard** - Comprehensive management interface
- **Security First** - RBAC, input validation, and isolated plugin execution
- **Database Isolation** - Plugin-specific PostgreSQL schemas
- **Theme System** - Customizable frontend and backend themes
- **Docker Support** - Full containerization with Docker Compose

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Plugin Development](#plugin-development)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🏃 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd kevinalthaus-com-oct
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services:**

   ```bash
   # Start database and Redis
   docker-compose up -d postgres redis

   # Start all development servers
   npm run dev:all
   ```

5. **Access the applications:**
   - **Frontend**: http://localhost:3002
   - **Admin Panel**: http://localhost:3003
   - **API Gateway**: http://localhost:3000
   - **Main App**: http://localhost:3001
   - **Python Service**: http://localhost:8000

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Admin Panel   │
│   (React)       │    │   (React)       │
│   Port 3002     │    │   Port 3003     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────────────────┼──────────────────────┐
                                 │                      │
                    ┌─────────────┴───────────┐         │
                    │    API Gateway          │         │
                    │    (Express.js)         │         │
                    │    Port 3000            │         │
                    └─────────────┬───────────┘         │
                                 │                      │
          ┌─────────────────────┬─┴───────────────────┐  │
          │                     │                     │  │
   ┌──────┴───────┐    ┌────────┴────────┐   ┌───────┴──┴──────┐
   │  Main App    │    │ Python Service  │   │  Plugin Engine │
   │ (Node.js)    │    │ (FastAPI)       │   │  (Node.js)     │
   │ Port 3001    │    │ Port 8000       │   │  Port 3004     │
   └──────┬───────┘    └────────┬────────┘   └───────┬────────┘
          │                     │                    │
          └─────────────────────┼────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    PostgreSQL         │
                    │    Port 5432          │
                    └───────────────────────┘
```

### Core Components

- **API Gateway**: Central routing, authentication, and rate limiting
- **Main App**: Core business logic and user management
- **Python Service**: Specialized services requiring Python ecosystem
- **Frontend**: Public-facing React application
- **Admin Panel**: Administrative interface for system management
- **Plugin Engine**: Isolated plugin execution environment
- **Shared Package**: Common utilities, types, and security functions

## 💻 Development Setup

### Manual Setup (Recommended for Development)

1. **Start required services:**

   ```bash
   docker-compose up -d postgres redis
   ```

2. **Start individual services in separate terminals:**

   ```bash
   # Terminal 1 - API Gateway
   cd packages/api-gateway
   npm run dev

   # Terminal 2 - Main App
   cd packages/main-app
   npm run dev

   # Terminal 3 - Frontend
   cd packages/frontend
   npm run dev

   # Terminal 4 - Admin Panel
   cd packages/admin
   npm run dev

   # Terminal 5 - Python Service
   cd python
   uvicorn main:app --reload
   ```

### Docker Setup (Full Stack)

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Available Scripts

```bash
# Development
npm run dev:all          # Start all services
npm run build           # Build all packages
npm run clean          # Clean build artifacts

# Testing
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode

# Code Quality
npm run lint           # Lint all code
npm run format         # Format code with Prettier
```

## 🔧 Plugin Development

The platform features a comprehensive plugin system allowing developers to extend functionality safely and securely.

### Creating a Plugin

1. **Create plugin directory:**

   ```bash
   mkdir my-awesome-plugin
   cd my-awesome-plugin
   npm init -y
   ```

2. **Create plugin manifest (`plugin.yaml`):**

   ```yaml
   name: my-awesome-plugin
   version: 1.0.0
   displayName: My Awesome Plugin
   description: An example plugin demonstrating the plugin system
   author:
     name: Your Name
     email: your.email@example.com
   capabilities:
     - database:read
     - database:write
     - api:call
   entrypoint: dist/index.js
   ```

3. **Implement plugin logic:**

   ```typescript
   // src/index.ts
   import { PluginExecutionContext, PluginLifecycleHooks } from '@monorepo/shared';

   export default class MyAwesomePlugin implements PluginLifecycleHooks {
     async onInstall(context: PluginExecutionContext): Promise<void> {
       context.logger.info('Plugin installed successfully');
     }

     async onActivate(context: PluginExecutionContext): Promise<void> {
       context.logger.info('Plugin activated');
       // Initialize plugin services
     }

     async onDeactivate(context: PluginExecutionContext): Promise<void> {
       context.logger.info('Plugin deactivated');
       // Cleanup active processes
     }
   }
   ```

### Plugin Features

- **Database Isolation**: Each plugin gets its own PostgreSQL schema
- **Resource Quotas**: Configurable limits on storage, connections, and queries
- **Security Sandbox**: Restricted execution environment
- **API Access**: Make external HTTP requests with built-in retry logic
- **Storage API**: Key-value storage scoped to your plugin
- **Logging**: Structured logging with metadata support
- **Theme System**: Create custom themes for frontend and backend

### Example Plugin Capabilities

```typescript
// Database operations
await context.database.query('SELECT * FROM users WHERE active = $1', [true]);

// External API calls
const data = await context.api.get('https://api.example.com/data', {
  headers: { Authorization: `Bearer ${context.config?.apiKey}` },
  timeout: 5000,
  retries: 3,
});

// Plugin storage
await context.storage.set('cache_key', { data, timestamp: Date.now() });
const cached = await context.storage.get('cache_key');

// Logging
context.logger.info('Operation completed', { recordCount: 100 });
```

For detailed plugin development documentation, see [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md).

## 📚 API Documentation

### Authentication

All API requests require JWT authentication:

```bash
# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:3000/api/users/me
```

### Core Endpoints

- `GET /health` - Service health check
- `POST /api/auth/login` - User authentication
- `GET /api/users` - List users (admin only)
- `GET /api/plugins` - List installed plugins
- `POST /api/plugins/install` - Install new plugin
- `GET /api/settings` - Get system settings

### Plugin APIs

Plugins have access to:

- **Database API**: Query plugin-specific schema
- **HTTP API**: Make external requests
- **Storage API**: Key-value storage
- **Logger API**: Structured logging
- **Theme API**: Register and manage themes

For complete API documentation, see [API Reference](./API_REFERENCE.md).

## 🚀 Deployment

### Ubuntu Production Deployment

**Quick Start** (Ubuntu 20.04/22.04/24.04 LTS):

```bash
# Automated deployment
sudo ./scripts/deploy-ubuntu.sh
```

This script will:

- Install Docker and Docker Compose
- Setup application directory (`/opt/kevinalthaus`)
- Configure firewall (UFW)
- Deploy all services with production configuration

**PostgreSQL Setup:**

The simple Docker command:

```bash
docker run --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kevinalthaus \
  -p 5432:5432 \
  -d postgres:16
```

**⚠️ Security Warning:** The hardcoded password `postgres` shown above is for **examples only**. In production, you **must** use a strong, randomly generated password stored securely (e.g., environment secrets, secret manager, or Docker secrets). Rotate credentials regularly. See [Docker secrets documentation](https://docs.docker.com/engine/swarm/secrets/) and [PostgreSQL security best practices](https://www.postgresql.org/docs/current/auth-methods.html).

Our production docker-compose setup improves this with:

- Health checks and automatic restart
- Persistent volumes for data safety
- Automated WAL archiving and backups
- Performance tuning (2GB RAM, optimized postgresql.conf)
- Security hardening (pg_hba.conf, restricted network)
- Monitoring views and statistics

**Access PostgreSQL:**

```bash
# CLI access
docker exec -it kevinalthaus-postgres-1 psql -U postgres -d kevinalthaus

# View logs
docker logs kevinalthaus-postgres-1

# Health check
docker exec kevinalthaus-postgres-1 pg_isready -U postgres
```

**Automated Maintenance:**

```bash
# Setup cron jobs for backups and monitoring
sudo ./scripts/setup-cron.sh
```

📘 **Complete deployment guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

### Production Deployment (Manual)

1. **Build the application:**

   ```bash
   npm run build
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env.production
   # Update with production values
   # Generate secrets: openssl rand -hex 32
   ```

3. **Deploy with Docker:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Environment Variables

Key environment variables for production:

```bash
# Application
NODE_ENV=production
API_GATEWAY_PORT=3000
MAIN_APP_PORT=3001

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=kevinalthaus

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-encryption-key

# Features
ENABLE_PLUGIN_SYSTEM=true
ENABLE_THEME_SYSTEM=true
```

### Health Checks

All services include health check endpoints:

```bash
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # Main App
curl http://localhost:8000/health  # Python Service
```

## 🛠 Technology Stack

### Frontend

- **React 18** - UI library
- **TypeScript** - Type safety
- **Material UI 5** - Component library
- **React Router** - Client-side routing
- **Vite** - Build tool

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **FastAPI** - Python web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions

### DevOps

- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **GitHub Actions** - CI/CD (future)
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific package
cd packages/main-app && npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Test Structure

```
packages/
├── main-app/
│   ├── src/
│   │   └── __tests__/
│   │       └── app.test.ts
│   └── jest.config.json
├── shared/
│   ├── src/
│   │   └── __tests__/
│   └── jest.config.json
```

## 📖 Documentation

- [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) - Complete guide for building plugins
- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Detailed architecture documentation
- [API Reference](./API_REFERENCE.md) - Complete API documentation

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes and add tests**
4. **Run the test suite:** `npm test`
5. **Lint your code:** `npm run lint`
6. **Commit your changes:** `git commit -m 'Add amazing feature'`
7. **Push to the branch:** `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Development Guidelines

- Write TypeScript for all new code
- Add tests for new functionality
- Follow the existing code style
- Update documentation for API changes
- Ensure all services have health checks

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Documentation**: Check the docs in this repository
- **Issues**: Open an issue on GitHub
- **Email**: contact@kevinalthaus.com

## 🗺 Roadmap

- [ ] Advanced theme editor
- [ ] Mobile application
- [ ] Advanced analytics dashboard
- [ ] GraphQL API

---

Built with ❤️ by Kevin Althaus
