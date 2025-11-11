# Comprehensive Testing Program (comp_)

This document tracks the multi-phase build-out of the testing suite for `kevinalthaus-com-oct`. All artifacts that belong to this program (Playwright specs, Jest/Vitest suites, helper utilities, docs) must live under `tests/` (or its child packages) and the filenames must start with the `comp_` prefix for fast discovery (example: `tests/e2e/comp_auth.spec.ts`). Keep this file updated as work progresses.

## Repo & Source References
- Monorepo root: `e:\dev\kevinalthaus-com-oct`
- Primary apps: `packages/api-gateway`, `packages/main-app`, `packages/admin`
- Plugins: `plugins/page-builder`, `plugins/ssdd-validator`
- Existing Playwright setup: `playwright.config.ts`, legacy specs under `e2e/`
- SSDD Validator frontend map/tabs reference: `plugins/ssdd-validator/frontend/ARCHITECTURE.md`

## Global Guardrails
1. **Tooling**: Playwright for E2E, Jest (or Vitest if conflicts) for unit/integration per package, tagged regression suites (`@smoke`, `@regression`).
2. **Selectors & Data**: Prefer `data-testid` selectors. Use deterministic seed scripts (e.g., `scripts/seed-e2e-user.ts`) for CRUD data in all phases.
3. **Security**: Cover RBAC, CSRF, rate limiting, token handling, and ensure tests never log secrets.
4. **CI**: Add workflows in `.github/workflows` to run targeted suites with coverage uploads. Gate merges on coverage thresholds (see phases).
5. **Documentation**: Update `tests/comp_testing_plan.md` and `docs/testing/` summaries when behaviors change. Track weekly status in `E2E-TEST-STATUS.md`.
6. **Regression Discipline**: Every new test must declare intent using tags or naming to ensure it can be pulled into regression runs quickly.

## Phase 1 – Foundation & Core Setup (Days 1-5)
**Scope**: Establish baseline infra, cover auth + dashboard flows, start regression smoke.

- ✅ `playwright.config.ts` now ingests specs from both `e2e/` and `tests/e2e/`; helper utilities live in `tests/e2e/utils/comp_helpers.ts`.
- ✅ New Playwright suites (all prefixed `comp_`):
  - `tests/e2e/comp_auth.spec.ts` (TEST-001) – login/logout, RBAC redirects, invalid credential handling.
  - `tests/e2e/comp_dashboard.spec.ts` (TEST-002) – analytics widgets, quick actions, API failure fallback.
  - `tests/e2e/comp_smoke.spec.ts` – baseline startup + navigation verification.
- ✅ Jest scaffolding + unit coverage:
  - `packages/main-app/src/routes/__tests__/comp_settings-public.test.ts`
  - `packages/admin/src/services/__tests__/comp_menusService.test.ts`
  - `plugins/page-builder/widgets/tabs/__tests__/comp_tabsWidget.test.tsx`
  - `plugins/page-builder/widgets/menu/__tests__/comp_menuWidget.test.tsx`
  - `plugins/ssdd-validator/frontend/src/components/__tests__/comp_addressValidatorForm.test.tsx`
- ✅ Added Jest configs + setup files for `packages/admin`, `plugins/page-builder`, `plugins/ssdd-validator/frontend`; reused existing `packages/main-app` setup.
- ✅ New scripts in repo root: `test:unit`, `test:smoke`, `test:regression` (use `@smoke`/`@regression` tags).
- ⏳ TODO: wire CI smoke gate + 20% coverage badge after the first report upload.

## Phase 2 – Core Admin Features (Days 6-10)
**Scope**: CRUD-heavy admin: users, blog, settings, taxonomy.

- Add Playwright specs TEST-003..006 under `tests/e2e/`:
  - `comp_users.spec.ts`: create/edit/deactivate user, verify auth unaffected.
  - `comp_blog.spec.ts`: create/publish/edit posts, verify dashboard stats.
  - `comp_settings.spec.ts`: update settings, validate persisted values (sync with `.env` placeholders).
  - `comp_taxonomy.spec.ts`: vocabulary + term workflows, filtering, pagination.
- Implement deterministic seeders (e.g., `scripts/seed-e2e-user.ts`) invoked from tests.
- Unit tests covering `UserFormDialog`, `BlogForm` validation, `TaxonomyService`, and settings cache modules. Mock DB/API layers.
- Regression suite enhancements: data-integrity checks, invalid input handling, cross-feature impacts.
- Targets: 50% repo coverage overall, ≥80% for core services. CI must fail fast on regressions.

## Phase 3 – Advanced Features & Integrations (Days 11-15)
**Scope**: Files, menus, AI services, frontend/public paths, API/security.

- Playwright specs TEST-007..012:
  - Files manager (upload/share/analytics link).
  - Page Builder widgets (tabs + menus) referencing `plugins/page-builder/widgets/**`.
  - AI services flows, validating prompt sanitation and response handling.
  - Public frontend routes (`packages/main-app/src/index.ts`) and API gateway integrations (`packages/api-gateway/src/server.ts`).
  - Security suite: CSRF, rate-limiting, token expiration paths.
- Create mock servers/fixtures (under `tests/mocks/comp_*`) for APIs and AI endpoints; wire into specs via `context.route`.
- Expand unit coverage: file upload middleware, menu tree helpers, AI prompt validation, security middleware.
- Regression: choreograph multi-step journeys (upload → share → analytics) and run targeted against recent git diffs. Aim for 80% coverage.

## Phase 4 – Review, Optimization, Full Regression (Days 16-20)
**Scope**: Final polish, full regression, performance & accessibility.

- Implement TEST-013 “Review” suite (`tests/e2e/comp_review.spec.ts`) orchestrating end-to-end happy paths plus negative cases; ensure plugins (page-builder, ssdd-validator) covered.
- Add visual regression (Playwright snapshots), performance budgets, accessibility checks (Axe). Enable parallel shards + trace uploads.
- Run comprehensive regression (`npm run test:regression`) covering all user workflows, API contracts, error paths. Integrate with Sentry/log parsing (e.g., `parse-test-results.js`).
- Ensure CI/CD pipeline enforces >90% coverage and total runtime <10 minutes (parallelization + selective runs). Upload artifacts and failure reports to `E2E-TEST-FAILURE-REPORT.md`.
- Document any residual risks, env needs, and follow-up work here.

## Status Tracking Checklist
- [x] Phase 1 completed (configs, smoke suites, ≥20% coverage target initiated).
- [ ] Phase 2 completed (CRUD specs, ≥50% coverage).
- [ ] Phase 3 completed (advanced integrations, ≥80% coverage).
- [ ] Phase 4 completed (>90% coverage, optimized CI, doc updates).

Update this list as phases finish, noting links/commits for historical context.
