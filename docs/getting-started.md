# Getting Started

## Prerequisites

- Node.js 20+
- Docker and Docker Compose v2

## Quick Start (Docker)

```bash
git clone https://github.com/blur702/kevinalthaus-com-oct.git
cd kevinalthaus-com-oct
cp .env.example .env

# Start core infra and app services
docker compose up -d
```

Access points (development):
- API Gateway: [http://localhost:3000](http://localhost:3000)
- Frontend: [http://localhost:3006](http://localhost:3006) (auto-resolves from 3002 if ports in use)
- Admin: [http://localhost:3008](http://localhost:3008) (auto-resolves from 3003 if ports in use)
- Main App health: [http://localhost:3001/health](http://localhost:3001/health) (internal)

**Note:** Ports auto-increment if already in use. Check console output for actual ports.

## Quick Start (Dev mode without Docker)

```bash
npm install
npm run build
npm run dev    # starts packages in parallel
```

## Common Commands

```bash
# Build all packages
npm run build

# Lint & format
npm run lint
npm run format

# E2E Tests (Playwright)
npx playwright test                        # run all tests
npx playwright test --headed               # run with browser UI
npx playwright test blog-creation          # run specific test
npx playwright show-report                 # view last report

# Unit Tests
npm test                                   # all (when available)
cd packages/main-app && npm test           # package specific
```

See `docs/testing.md` for comprehensive testing guide.

## Script Helper

Use the `scripts/web` helper to start/stop the full stack quickly:

```bash
# Start all services (resolves port conflicts automatically)
./scripts/web -on

# Stop all services
./scripts/web -off
```

See `docs/scripts.md` for details.
