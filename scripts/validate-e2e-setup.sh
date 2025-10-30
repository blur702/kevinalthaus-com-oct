#!/bin/bash

##############################################################################
# E2E Testing Setup Validation Script
#
# This script validates that the E2E testing infrastructure is properly set up
# and ready to run tests.
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "E2E Testing Setup Validation"
echo "================================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "${GREEN}✓${NC} Node.js version: $(node -v)"
else
    echo -e "${RED}✗${NC} Node.js version $(node -v) is too old. Requires Node.js 20+"
    exit 1
fi

# Check npm version
echo "Checking npm version..."
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓${NC} npm version: $NPM_VERSION"

# Check if dependencies are installed
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${RED}✗${NC} node_modules not found. Run: npm install"
    exit 1
fi

# Check Playwright installation
echo "Checking Playwright..."
if command -v npx &> /dev/null; then
    PLAYWRIGHT_VERSION=$(npx playwright --version 2>&1 | grep -oP 'Version \K[0-9.]+' || echo "unknown")
    if [ "$PLAYWRIGHT_VERSION" != "unknown" ]; then
        echo -e "${GREEN}✓${NC} Playwright version: $PLAYWRIGHT_VERSION"
    else
        echo -e "${YELLOW}⚠${NC} Playwright installed but version unknown"
    fi
else
    echo -e "${RED}✗${NC} npx not found"
    exit 1
fi

# Check Playwright browsers
echo "Checking Playwright browsers..."
BROWSER_PATH="$HOME/.cache/ms-playwright"
if [ -d "$BROWSER_PATH" ] || [ -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo -e "${GREEN}✓${NC} Playwright browsers installed"
else
    echo -e "${YELLOW}⚠${NC} Playwright browsers may not be installed. Run: npx playwright install"
fi

# Check test files exist
echo "Checking test files..."
TEST_FILES=(
    "e2e/auth.spec.ts"
    "e2e/dashboard.spec.ts"
    "e2e/users.spec.ts"
    "e2e/global-setup.ts"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file not found"
        exit 1
    fi
done

# Check utility files
echo "Checking utility files..."
UTIL_FILES=(
    "e2e/utils/auth.ts"
    "e2e/utils/api.ts"
    "e2e/utils/fixtures.ts"
    "e2e/utils/selectors.ts"
)

for file in "${UTIL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file not found"
        exit 1
    fi
done

# Check configuration files
echo "Checking configuration..."
if [ -f "playwright.config.ts" ]; then
    echo -e "${GREEN}✓${NC} playwright.config.ts"
else
    echo -e "${RED}✗${NC} playwright.config.ts not found"
    exit 1
fi

# Check GitHub Actions workflow
echo "Checking CI/CD configuration..."
if [ -f ".github/workflows/e2e-tests.yml" ]; then
    echo -e "${GREEN}✓${NC} .github/workflows/e2e-tests.yml"
else
    echo -e "${YELLOW}⚠${NC} .github/workflows/e2e-tests.yml not found (CI/CD not configured)"
fi

# Check documentation
echo "Checking documentation..."
DOC_FILES=(
    "e2e/README.md"
    "e2e/QUICK_START.md"
    "E2E_TESTING_SUMMARY.md"
)

for file in "${DOC_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${YELLOW}⚠${NC} $file not found"
    fi
done

# Check package.json scripts
echo "Checking npm scripts..."
if grep -q "test:e2e" package.json; then
    echo -e "${GREEN}✓${NC} test:e2e script configured"
else
    echo -e "${RED}✗${NC} test:e2e script not found in package.json"
    exit 1
fi

# Check admin panel availability (optional)
echo "Checking admin panel availability..."
if curl --max-time 5 --connect-timeout 2 -s -o /dev/null -w "%{http_code}" http://localhost:3003 | grep -q "200\|404"; then
    echo -e "${GREEN}✓${NC} Admin panel is accessible at http://localhost:3003"
else
    echo -e "${YELLOW}⚠${NC} Admin panel not running. Start it with: cd packages/admin && npm run dev"
fi

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}Setup Validation Complete!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Ensure admin panel is running: cd packages/admin && npm run dev"
echo "  2. Run tests: npm run test:e2e"
echo "  3. Or use UI mode: npm run test:e2e:ui"
echo ""
echo "Documentation:"
echo "  - Quick start: e2e/QUICK_START.md"
echo "  - Full docs: e2e/README.md"
echo "  - Summary: E2E_TESTING_SUMMARY.md"
echo ""
