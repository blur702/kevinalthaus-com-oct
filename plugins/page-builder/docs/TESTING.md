# Page Builder Testing Guide

This document provides testing strategies, examples, and best practices for the Page Builder plugin.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Migration Tests](#migration-tests)
- [Accessibility Tests](#accessibility-tests)
- [Performance Tests](#performance-tests)
- [Test Setup](#test-setup)

## Testing Strategy

### Test Pyramid

```
       /\
      /  \  E2E Tests (5%)
     /____\
    /      \  Integration Tests (25%)
   /________\
  /          \  Unit Tests (70%)
 /____________\
```

- **70% Unit Tests**: Fast, isolated tests for functions and components
- **25% Integration Tests**: Database, API, and service integration
- **5% E2E Tests**: Full user flows through the UI

### Coverage Goals

- **Line Coverage**: 80% minimum
- **Branch Coverage**: 75% minimum
- **Function Coverage**: 85% minimum

## Unit Tests

### Testing Lifecycle Hooks

Test plugin installation, activation, and deactivation:

```typescript
// __tests__/plugin-lifecycle.test.ts
import PageBuilderPlugin from '../src/index';
import { Pool } from 'pg';

describe('PageBuilderPlugin Lifecycle', () => {
  let plugin: PageBuilderPlugin;
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: any;

  beforeEach(() => {
    plugin = new PageBuilderPlugin();
    mockPool = {
      query: jest.fn(),
      connect: jest.fn()
    } as any;
    mockLogger = {
      log: jest.fn(),
      error: jest.fn()
    };
  });

  describe('onInstall', () => {
    it('should run migrations successfully', async () => {
      const mockContext = {
        db: mockPool,
        app: {} as any,
        logger: mockLogger
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Migration table check
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      } as any);

      await plugin.onInstall(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Installing Page Builder Plugin')
      );
    });

    it('should throw if database is not available', async () => {
      const mockContext = {
        db: null,
        app: {} as any,
        logger: mockLogger
      };

      await expect(plugin.onInstall(mockContext as any)).rejects.toThrow(
        'Database pool not available'
      );
    });

    it('should rollback on migration failure', async () => {
      const mockContext = {
        db: mockPool,
        app: {} as any,
        logger: mockLogger
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('SQL syntax error')), // Migration SQL
        release: jest.fn()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.connect.mockResolvedValue(mockClient as any);

      await expect(plugin.onInstall(mockContext)).rejects.toThrow();
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('onActivate', () => {
    it('should activate successfully', async () => {
      const mockContext = {
        db: mockPool,
        app: {} as any,
        services: {},
        logger: mockLogger
      };

      await plugin.onActivate(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('activated successfully')
      );
    });
  });

  describe('onDeactivate', () => {
    it('should cleanup resources', async () => {
      const mockContext = {
        logger: mockLogger
      };

      await plugin.onDeactivate(mockContext as any);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('deactivated')
      );
    });
  });
});
```

### Testing Type Validation

Test Joi schemas and validation functions:

```typescript
// __tests__/validation.test.ts
import {
  validatePageLayout,
  validateWidgetInstance,
  createEmptyLayout
} from '../src/types';

describe('Page Layout Validation', () => {
  describe('validatePageLayout', () => {
    it('should accept valid layout', () => {
      const validLayout = {
        version: '1.0',
        grid: {
          columns: 12,
          gap: { unit: 'px', value: 16 },
          snapToGrid: true,
          breakpoints: [
            { name: 'mobile', minWidth: 0, columns: 4 }
          ]
        },
        widgets: []
      };

      expect(() => validatePageLayout(validLayout)).not.toThrow();
    });

    it('should reject invalid version', () => {
      const invalidLayout = {
        version: '2.0', // Invalid version
        grid: {
          columns: 12,
          gap: { unit: 'px', value: 16 },
          snapToGrid: true,
          breakpoints: [{ name: 'mobile', minWidth: 0 }]
        },
        widgets: []
      };

      expect(() => validatePageLayout(invalidLayout)).toThrow('Invalid page layout');
    });

    it('should reject out-of-range columns', () => {
      const invalidLayout = createEmptyLayout();
      invalidLayout.grid.columns = 25; // Max is 24

      expect(() => validatePageLayout(invalidLayout)).toThrow();
    });

    it('should reject invalid gap unit', () => {
      const invalidLayout = createEmptyLayout();
      (invalidLayout.grid.gap as any).unit = 'em'; // Not allowed

      expect(() => validatePageLayout(invalidLayout)).toThrow();
    });
  });

  describe('validateWidgetInstance', () => {
    it('should accept valid widget', () => {
      const validWidget = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'text-content',
        position: { x: 0, y: 0, width: 12, height: 1 },
        config: { content: 'Hello' }
      };

      expect(() => validateWidgetInstance(validWidget)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const invalidWidget = {
        id: 'not-a-uuid',
        type: 'text-content',
        position: { x: 0, y: 0, width: 12, height: 1 },
        config: {}
      };

      expect(() => validateWidgetInstance(invalidWidget)).toThrow();
    });

    it('should reject negative position', () => {
      const invalidWidget = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'text-content',
        position: { x: -1, y: 0, width: 12, height: 1 },
        config: {}
      };

      expect(() => validateWidgetInstance(invalidWidget)).toThrow();
    });
  });
});
```

## Integration Tests

### Database Integration

Test actual database operations:

```typescript
// __tests__/integration/database.test.ts
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { createEmptyLayout } from '../../src/types';

describe('Database Integration', () => {
  let pool: Pool;
  let testUserId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });

    // Create test user
    const result = await pool.query(
      'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id',
      ['test@example.com', 'hashed']
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM public.users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('Pages Table', () => {
    it('should create and retrieve a page', async () => {
      const pageId = uuidv4();
      const layout = createEmptyLayout();

      await pool.query(
        `INSERT INTO plugin_page_builder.pages
         (id, title, slug, layout_json, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pageId, 'Test Page', 'test-page', JSON.stringify(layout), 'draft', testUserId]
      );

      const result = await pool.query(
        'SELECT * FROM plugin_page_builder.pages WHERE id = $1',
        [pageId]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe('Test Page');
      expect(result.rows[0].layout_json).toMatchObject(layout);

      // Cleanup
      await pool.query('DELETE FROM plugin_page_builder.pages WHERE id = $1', [pageId]);
    });

    it('should enforce unique slug constraint', async () => {
      const page1Id = uuidv4();
      const page2Id = uuidv4();
      const layout = createEmptyLayout();

      await pool.query(
        `INSERT INTO plugin_page_builder.pages
         (id, title, slug, layout_json, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [page1Id, 'Page 1', 'duplicate-slug', JSON.stringify(layout), 'draft', testUserId]
      );

      await expect(
        pool.query(
          `INSERT INTO plugin_page_builder.pages
           (id, title, slug, layout_json, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [page2Id, 'Page 2', 'duplicate-slug', JSON.stringify(layout), 'draft', testUserId]
        )
      ).rejects.toThrow();

      // Cleanup
      await pool.query('DELETE FROM plugin_page_builder.pages WHERE id = $1', [page1Id]);
    });

    it('should create version on update', async () => {
      const pageId = uuidv4();
      const layout = createEmptyLayout();

      // Create page
      await pool.query(
        `INSERT INTO plugin_page_builder.pages
         (id, title, slug, layout_json, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pageId, 'Versioned Page', 'versioned', JSON.stringify(layout), 'draft', testUserId]
      );

      // Update page (should trigger version creation)
      const updatedLayout = createEmptyLayout();
      updatedLayout.widgets.push({
        id: uuidv4(),
        type: 'text-content',
        position: { x: 0, y: 0, width: 12, height: 1 },
        config: { content: 'New content' }
      });

      await pool.query(
        `UPDATE plugin_page_builder.pages
         SET layout_json = $1, updated_by = $2
         WHERE id = $3`,
        [JSON.stringify(updatedLayout), testUserId, pageId]
      );

      // Check version was created
      const versions = await pool.query(
        'SELECT * FROM plugin_page_builder.page_versions WHERE page_id = $1',
        [pageId]
      );

      expect(versions.rows.length).toBeGreaterThan(0);
      expect(versions.rows[0].version_number).toBe(1);

      // Cleanup
      await pool.query('DELETE FROM plugin_page_builder.pages WHERE id = $1', [pageId]);
    });
  });
});
```

## Migration Tests

Test migration idempotency and rollback:

```typescript
// __tests__/migrations.test.ts
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

describe('Database Migrations', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should apply all migrations successfully', async () => {
    const migrationsPath = path.join(__dirname, '../migrations');
    const files = (await fs.readdir(migrationsPath))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
      await expect(pool.query(sql)).resolves.not.toThrow();
    }
  });

  it('should be idempotent (safe to run twice)', async () => {
    const migrationsPath = path.join(__dirname, '../migrations');
    const files = (await fs.readdir(migrationsPath))
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Run migrations second time
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
      await expect(pool.query(sql)).resolves.not.toThrow();
    }

    // Check no duplicate data
    const result = await pool.query(
      'SELECT migration_name, COUNT(*) as count FROM plugin_page_builder.plugin_migrations GROUP BY migration_name HAVING COUNT(*) > 1'
    );

    expect(result.rows).toHaveLength(0);
  });
});
```

## Accessibility Tests

Test WCAG AA compliance:

```typescript
// __tests__/accessibility.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should have no violations in page editor', async () => {
    const { container } = render(<PageEditor />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', () => {
    const { getByRole } = render(<WidgetPalette />);

    expect(getByRole('toolbar', { name: 'Widget palette' })).toBeInTheDocument();
  });

  it('should support keyboard navigation', () => {
    const { getByTestId } = render(<GridCanvas />);
    const widget = getByTestId('widget-1');

    widget.focus();
    expect(document.activeElement).toBe(widget);
    expect(widget).toHaveAttribute('tabIndex', '0');
  });
});
```

## Performance Tests

Test rendering performance and database query efficiency:

```typescript
// __tests__/performance.test.ts
import { Pool } from 'pg';

describe('Performance', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });
  });

  it('should query pages with JSONB efficiently', async () => {
    const start = Date.now();

    await pool.query(`
      SELECT * FROM plugin_page_builder.pages
      WHERE layout_json @> '{"widgets": [{"type": "text-content"}]}'
      LIMIT 10
    `);

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should be fast with GIN index
  });

  it('should handle large widget counts', () => {
    const layout = createEmptyLayout();

    // Add 100 widgets
    for (let i = 0; i < 100; i++) {
      layout.widgets.push({
        id: uuidv4(),
        type: 'text-content',
        position: { x: 0, y: i, width: 12, height: 1 },
        config: { content: `Widget ${i}` }
      });
    }

    const start = Date.now();
    validatePageLayout(layout);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50); // Validation should be fast
  });
});
```

## Test Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThresholds: {
    global: {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts']
};
```

### Test Setup File

```typescript
// __tests__/setup.ts
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(10000);

// Mock logger
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
};
```

### Test Database Setup

```bash
# .env.test
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/page_builder_test
```

```sql
-- Setup test database
CREATE DATABASE page_builder_test;
\c page_builder_test

-- Run migrations
\i migrations/01-create-schema.sql
\i migrations/02-create-page-tables.sql
\i migrations/03-create-template-tables.sql
\i migrations/04-create-reusable-blocks-table.sql
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- plugin-lifecycle.test.ts

# Run in watch mode
npm run test:watch

# Run integration tests only
npm test -- --testPathPattern=integration
```

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: page_builder_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/page_builder_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [jest-axe for Accessibility Testing](https://github.com/nickcolley/jest-axe)
- [Supertest for API Testing](https://github.com/visionmedia/supertest)
