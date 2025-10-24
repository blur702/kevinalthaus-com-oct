# Kevin Althaus Platform

Modern, extensible web platform with microservices architecture and plugin system.

## Key Features

- Plugin System - Extensible architecture with security sandboxing
- Theme System - Frontend/backend customization via plugins
- Security - RBAC, input validation, timing-safe operations
- Admin Dashboard - User management, plugin management, analytics
- Docker Ready - Full containerization with production configs
- Scalable - Microservices with independent scaling

## Documentation

For detailed information, see:

- **[Setup & Development](./assets/docs/development.md)** - Development environment setup
- **[Architecture Guide](./assets/docs/architecture.md)** - System design and patterns
- **[Plugin Development](./assets/docs/plugins.md)** - Creating and managing plugins
- **[API Reference](./assets/docs/api.md)** - Complete API documentation
- **[Deployment Guide](./assets/docs/deployment.md)** - Production deployment
- **[Security Guide](./assets/docs/security.md)** - Security implementation details

## Quick Start

**Prerequisites:** Node.js 20+, Docker, Docker Compose

```bash
# Clone and setup
git clone <repository-url>
cd kevinalthaus-com-oct
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d postgres redis
npm run dev:all
```

**Access Points:**
- Frontend: http://localhost:3002
- Admin Panel: http://localhost:3003  
- API Gateway: http://localhost:3000
- Main App: http://localhost:3001

## Architecture

**Microservices Stack:**
- **API Gateway** (Express.js) - Central routing, auth, rate limiting
- **Main App** (Node.js) - Core business logic, user management
- **Python Service** (FastAPI) - Specialized Python ecosystem services
- **Frontend** (React + Material-UI) - Public interface
- **Admin Panel** (React + Material-UI) - Management interface
- **Plugin Engine** (Node.js) - Isolated plugin execution
- **Database** (PostgreSQL) - Primary data store
- **Cache** (Redis) - Sessions and caching

## Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/name`
3. Make changes and add tests
4. Run checks: `npm test && npm run lint`
5. Submit pull request

## License

MIT License - see LICENSE file for details.
