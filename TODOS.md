# Project TODOs

This file consolidates all TODO items, action items, and future enhancements from various markdown files in the project.

## From `e:\dev\kevinalthaus-com-oct\AUTHENTICATION-DEBUG-REPORT.md`

### Prevention Recommendations
- [ ] Update `.env.example` to show correct default password.
- [ ] Add comments to `.env.example` explaining where defaults come from.
- [ ] Consider using the same password across all seed scripts for consistency.
- [ ] Make it more obvious when different passwords are used in seed scripts.
- [ ] E2E test setup should verify credentials before running tests.
- [ ] Add a database check in `global-setup.ts` to validate the test user.
- [ ] Consider adding an initial admin user migration.
- [ ] Document expected default credentials.

## From `e:\dev\kevinalthaus-com-oct\E2E-TEST-ANALYSIS-REPORT.md`

### Recommendations

#### Immediate Actions (Critical Path)
- [ ] Fix Service Initialization Race Condition.
- [ ] Fix Connection Pooling issues.
- [ ] Enable Auth Persistence in tests.
- [ ] Fix Plugin Registration failures.

#### Short-term Fixes (High Priority)
- [ ] Reduce Test Parallelism to decrease load.
- [ ] Add Test Retries for flaky connection errors.
- [ ] Fix API Endpoint Registrations for `/api/users`, `/api/blog`, `/api/analytics`, `/api/dashboard`.
- [ ] Fix CSRF Implementation.

#### Medium-term Improvements
- [ ] Add Test Isolation using a separate database for each test file.
- [ ] Optimize Test Performance by fixing slow tests.
- [ ] Improve Error Reporting with detailed logging and screenshots on failure.
- [ ] Add Monitoring for test execution time and service health.

### Next Steps
- [ ] **STOP THE TEST RUN** if it's still running.
- [ ] Fix `global-setup.ts` to add proper health checks and auth setup.
- [ ] Verify all services are running and responding correctly.
- [ ] Fix plugin registration to ensure all API endpoints are mounted.
- [ ] Re-run a single test file to verify the fix before running the full suite.
- [ ] Gradually expand the test run by adding test files one at a time.

## From `e:\dev\kevinalthaus-com-oct\E2E-TEST-FAILURE-REPORT.md`

### Recommended Fix Priority

- [ ] **Priority 1: CRITICAL - Start Backend Services**
    - [ ] Start API Gateway (port 3000).
    - [ ] Start Main App (port 3001).
    - [ ] Start Plugin Engine (port 3004).
    - [ ] Verify services are running and healthy.
- [ ] **Priority 2: HIGH - Fix Plugin Dependencies**
    - [ ] Install missing `sequelize` dependency.
    - [ ] Remove or fix the reference to `example-service-plugin`.
    - [ ] Fix Vault connection or disable it if not needed.
- [ ] **Priority 3: MEDIUM - Configuration Issues**
    - [ ] Update `JWT_SECRET` to be at least 32 characters long.
    - [ ] Configure Vault properly or disable health checks if not used.
- [ ] **Priority 4: LOW - Rerun Tests After Fixes**
    - [ ] Clear test results.
    - [ ] Rerun the full E2E test suite.
    - [ ] Analyze any remaining failures.

### Action Required
- [ ] Start all backend services (API Gateway, Main App, Plugin Engine) before running E2E tests.

### Next Steps
- [ ] Start backend services.
- [ ] Fix plugin dependencies.
- [ ] Rerun tests.
- [ ] Address any remaining failures individually.

## From `e:\dev\kevinalthaus-com-oct\E2E-TEST-STATUS.md`

### How to Complete the Test
- [ ] **Option 1: Clear Redis (Recommended)**.
- [ ] **Option 2: Wait for Rate Limit to Expire** (15 minutes).
- [ ] **Option 3: Restart Redis Container**.

### Running the Test
- [ ] Run `npx playwright test e2e/change-site-name.spec.ts --headed --project=chromium`.

### Next Action
- [ ] Clear Redis and run the test command.

## From `e:\dev\kevinalthaus-com-oct\OVERNIGHT-DEBUG-REPORT.md`

### Remaining Work (Non-Critical)
- [ ] **Linting Cleanup**: Address the ~1,467 remaining linting errors.
- [ ] **Frontend Services**: Start the Admin panel (port 3003) and Python service (port 8000) if needed.
- [ ] **Security Enhancements**: Update `JWT_SECRET` to 32+ characters.
- [ ] **Plugin Improvements**: Fix or remove the disabled `comments` plugin.
- [ ] **E2E Test Infrastructure**: Implement auth persistence in global setup and increase the database connection pool for parallel tests.

### Next Steps (When You Wake Up)
- [ ] Review the overnight debug report.
- [ ] Start the frontend services if needed.
- [ ] Review the E2E test analysis for remaining improvements.
- [ ] Optional: Work through remaining linting errors incrementally.
- [ ] Optional: Update `JWT_SECRET` to 32+ characters.
- [ ] Deploy to staging.

## From `e:\dev\kevinalthaus-com-oct\PAGE-BUILDER-TEST-REPORT.md`

### Next Steps

#### Immediate Actions
- [ ] **Fix Login Form**: Add `name="username"` and `name="password"` to the login form inputs.
- [ ] **Re-run Test**: `npx playwright test e2e/page-builder-test-manual.spec.ts --headed`.
- [ ] **Complete Workflow**: Login, create a test page, add an accordion widget, and save.

#### Future Enhancements
- [ ] Add `data-testid` attributes to key UI elements.
- [ ] Implement proper E2E authentication persistence.
- [ ] Create page builder component tests.
- [ ] Add widget interaction tests.

### Action Required
- [ ] Add `name` attributes to login form inputs to enable successful login automation.

## From `e:\dev\kevinalthaus-com-oct\PAGE_BUILDER_IMPLEMENTATION_SUMMARY.md`

### Next Steps (Future Enhancements)
- [ ] **1. Drag-and-Drop Editor**: Implement a React-based grid editor.
- [ ] **2. Widget Library**: Implement core widgets (Text, Image, Video, etc.).
- [ ] **3. Template System**: Implement pre-built templates, a marketplace, and import/export functionality.
- [ ] **4. Advanced Features**: Implement real-time collaboration, auto-save, scheduled publishing, A/B testing, etc.
- [ ] **5. Performance Optimization**: Implement widget lazy loading, code splitting, image optimization, etc.

## From `e:\dev\kevinalthaus-com-oct\QUICK-START-GUIDE.md`

### Next Recommended Steps
- [ ] Review the overnight report.
- [ ] Test your API endpoints.
- [ ] Optional: Start admin UI (`cd packages/admin && npm start`).
- [ ] Optional: Work through remaining linting errors.
- [ ] Deploy to staging.

## From `e:\dev\kevinalthaus-com-oct\RATE-LIMIT-FIX-REPORT.md`

### Remaining Issues
- [ ] **1. Login Cookie Handling**: Configure Playwright to accept and store cookies, or implement session storage context.
- [ ] **2. Page Builder Route**: The Page Builder plugin needs to register its route with the admin panel.

### What Needs Attention
- [ ] Cookie-based authentication in Playwright tests.
- [ ] Page Builder route registration in the admin panel.
- [ ] Redis setup for distributed rate limiting (optional).

## From `e:\dev\kevinalthaus-com-oct\README.md`

### Action Required
- [ ] All deployments now require a `JWT_SECRET` environment variable. Run `./scripts/ensure-jwt-secret.sh` to generate one.

## From `e:\dev\kevinalthaus-com-oct\SENTRY-FIXES-COMPLETE.md`

### Next Steps
- [ ] Refresh http://localhost:3003 in your browser.
- [ ] Open the DevTools Console to verify Sentry is enabled.
- [ ] Run the test: `window.Sentry.captureMessage('Hello Sentry!')`.
- [ ] Check the Sentry dashboard for the test message.

## From `e:\dev\kevinalthaus-com-oct\SENTRY-SETUP-REPORT.md`

### Next Steps

#### Immediate Actions
- [ ] Manual browser testing of Sentry integration.
- [ ] Verify errors appear in the Sentry dashboard.

#### Optional Improvements
- [ ] Configure source map uploads for production.
- [ ] Set up Sentry alerts and notifications.
- [ ] Create custom error boundaries for better error handling.
- [ ] Configure Sentry releases and deployments.
- [ ] Add user context to Sentry events.
- [ ] Fix CORS issues for automated testing.

### User Action Required
- [ ] Please test Sentry integration manually.

## From `e:\dev\kevinalthaus-com-oct\SETTINGS_INTEGRATION_SUMMARY.md`

### Next Steps to Debug
- [ ] Check CORS Configuration.
- [ ] Add Network Debugging.
- [ ] Check Browser Console.
- [ ] Try an alternative test.

## From `e:\dev\kevinalthaus-com-oct\docs\deployment.md`

### PostgreSQL 16 Upgrade Checklist
- [ ] Pre-Upgrade Steps.
- [ ] Staging Environment Testing.
- [ ] Production Upgrade Path.
- [ ] Rollback Plan.
- [ ] Expected Downtime.

## From `e:\dev\kevinalthaus-com-oct\docs\sentry-auth-setup.md`

- [ ] **Step 1: Create Sentry Auth Token**.
- [ ] **Step 2: Add Token to Environment**.
- [ ] **Step 3: Install Sentry Vite Plugin**.
- [ ] **Step 4: Update Vite Configs**.
- [ ] **Step 5: Test Source Map Upload**.

## From `e:\dev\kevinalthaus-com-oct\docs\sentry-integration.md`

### Next Steps
- [ ] Set up Sentry Alerts.
- [ ] Adjust Performance Monitoring sample rates.
- [ ] Integrate User Feedback widget.
- [ ] Automate Release Tracking.
- [ ] Connect Sentry with Slack, PagerDuty, or Jira.

## From `e:\dev\kevinalthaus-com-oct\docs\sentry-testing.md`

### Next Steps
- [ ] Configure Sentry Alerts.
- [ ] Adjust sample rates for performance and replay.
- [ ] Integrate with CI/CD for source map uploads.
- [ ] Set up release tracking.
- [ ] Enable the user feedback widget.

## From `e:\dev\kevinalthaus-com-oct\docs\sentry-validation.md`

### Optional Enhancements
- [ ] Set up source map uploads (requires `SENTRY_AUTH_TOKEN`).
- [ ] Remove debug code (`sentry-debug.tsx`, console logs).
- [ ] Apply the same Sentry configuration to the admin package.
- [ ] Configure Sentry alerts and notifications.
- [ ] Set up release tracking in CI/CD.
- [ ] Adjust sample rates based on traffic.

### Before Deployment
- [ ] Remove Debug Code.
- [ ] Adjust Sentry Settings (Optional).
- [ ] Configure Source Maps (Optional but Recommended).
- [ ] Test in Production.

## From `e:\dev\kevinalthaus-com-oct\docs\status.md`

### Advanced Features PENDING
- [ ] Email System.
- [ ] API Documentation.
- [ ] Enhanced Security.

## From `e:\dev\kevinalthaus-com-oct\docs\testing.md`

### Coverage Gaps
- [ ] Plugin management UI.
- [ ] Plugin API endpoints.
- [ ] File upload workflows (media library).
- [ ] Content publishing/scheduling.
- [ ] Email functionality (if implemented).
- [ ] WebSocket/real-time features (if implemented).
- [ ] Mobile-specific tests.
- [ ] Accessibility (a11y) tests.
- [ ] Performance/load tests.
- [ ] Database migration tests.

## From `e:\dev\kevinalthaus-com-oct\plugins\ssdd-validator\frontend\ARCHITECTURE.md`

### Deployment Checklist
- [ ] `npm install` completes.
- [ ] TypeScript compiles without errors.
- [ ] ESLint passes.
- [ ] All components render.
- [ ] API endpoints accessible.
- [ ] Authentication working.
- [ ] Map tiles load.
- [ ] Form validation works.
- [ ] Pagination works.
- [ ] Tabs switch correctly.
- [ ] Loading states show.
- [ ] Error messages display.
- [ ] Mobile responsive.
- [ ] Accessibility audit passes.
- [ ] Browser compatibility tested.

### Future Architecture Considerations
- [ ] **Scalability**: Add Redux, WebSockets, service worker, virtual scrolling.
- [ ] **Maintainability**: Add Storybook, design system tokens, shared component library, visual regression tests.
- [ ] **Features**: Add export functionality, map clustering, address autocomplete, batch validation.

## From `e:\dev\kevinalthaus-com-oct\plugins\ssdd-validator\frontend\COMPONENT_SUMMARY.md`

### Future Enhancements

#### High Priority
- [ ] Unit tests with Jest + React Testing Library.
- [ ] E2E tests with Playwright.
- [ ] Storybook for component showcase.
- [ ] Error boundary component.

#### Medium Priority
- [ ] Accessibility audit with axe-core.
- [ ] Performance profiling with React DevTools.
- [ ] Code splitting with `React.lazy`.
- [ ] Service worker for offline support.

#### Low Priority
- [ ] Internationalization (i18n).
- [ ] Dark mode toggle.
- [ ] Export to CSV/PDF.
- [ ] Print-friendly styles.
- [ ] WebSocket live updates.
