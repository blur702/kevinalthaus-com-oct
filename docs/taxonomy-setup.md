# Taxonomy System Setup

## Overview

The taxonomy system provides a flexible way to classify and organize content using vocabularies and terms. This system is inspired by Drupal's taxonomy module and allows for hierarchical categorization of any content type.

### Core Concepts

- **Vocabulary**: A collection of terms used for classification (e.g., "Categories", "Tags")
- **Term**: An individual classification label within a vocabulary (e.g., "Technology", "News")
- **Entity**: Any content item that can be tagged (e.g., blog posts, pages)
- **Entity-Term Relationship**: The many-to-many mapping between entities and terms

### Architecture

```
Vocabularies (categories, tags, etc.)
    ↓
Terms (individual labels)
    ↓
Entity-Terms Junction Table
    ↓
Entities (blog posts, pages, etc.)
```

## Default Vocabularies

Two default vocabularies are automatically created when the application starts:

### Categories Vocabulary

- **Name**: Categories
- **Machine Name**: `categories`
- **Description**: Content categories for organizing posts and pages
- **Hierarchy Depth**: 2 (supports parent-child relationships)
- **Allow Multiple**: Yes (entities can have multiple categories)
- **Required**: No
- **Weight**: 0

**Use Case**: Organize content into broad topics like "Technology", "Business", "Lifestyle"

### Tags Vocabulary

- **Name**: Tags
- **Machine Name**: `tags`
- **Description**: Tags for content classification
- **Hierarchy Depth**: 0 (flat structure, no hierarchy)
- **Allow Multiple**: Yes (entities can have multiple tags)
- **Required**: No
- **Weight**: 1

**Use Case**: Add specific keywords or labels to content for filtering and discovery

### Automatic Seeding

Default vocabularies are automatically created on first application startup:
- The seed script runs after database migrations
- It's idempotent (safe to run multiple times)
- Check logs for: `[Seed] Created "categories" vocabulary` or `[Seed] "categories" vocabulary already exists`

## Database Schema

### vocabularies Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Display name |
| machine_name | VARCHAR(100) | Unique machine-readable identifier |
| description | TEXT | Optional description |
| hierarchy_depth | INTEGER | Maximum depth of term hierarchy (0 = flat) |
| allow_multiple | BOOLEAN | Allow multiple terms per entity |
| required | BOOLEAN | Is selection required |
| weight | INTEGER | Sort order |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Unique Constraint**: `machine_name` must be unique

### terms Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vocabulary_id | UUID | Foreign key to vocabularies |
| name | VARCHAR(255) | Display name |
| machine_name | VARCHAR(255) | Unique machine-readable identifier within vocabulary |
| description | TEXT | Optional description |
| parent_id | UUID | Optional parent term for hierarchy |
| weight | INTEGER | Sort order within vocabulary |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Foreign Keys**:
- `vocabulary_id` → `vocabularies.id` (CASCADE delete)
- `parent_id` → `terms.id` (SET NULL on delete)

**Unique Constraint**: `(vocabulary_id, machine_name)`

### entity_terms Table (Junction)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| entity_type | VARCHAR(100) | Type of entity (e.g., 'blog_post', 'page') |
| entity_id | UUID | ID of the entity |
| term_id | UUID | Foreign key to terms |
| created_at | TIMESTAMP | Creation timestamp |

**Foreign Keys**:
- `term_id` → `terms.id` (CASCADE delete)

**Unique Constraint**: `(entity_type, entity_id, term_id)`

### Entity Relationship Diagram

```
vocabularies (1) ──< (many) terms
                              │
                              │ (many)
                              │
                              ↓
                        entity_terms ──> entities (not enforced by FK)
```

## API Endpoints

All taxonomy endpoints are mounted at `/api/taxonomy` and require JWT authentication.

### Vocabularies

#### List All Vocabularies
```
GET /api/taxonomy/vocabularies
```
Returns all vocabularies ordered by weight.

#### Get Vocabulary by ID
```
GET /api/taxonomy/vocabularies/:id
```

#### Get Vocabulary by Machine Name
```
GET /api/taxonomy/vocabularies/machine-name/:machineName
```
Example: `GET /api/taxonomy/vocabularies/machine-name/categories`

#### Create Vocabulary
```
POST /api/taxonomy/vocabularies
Content-Type: application/json

{
  "name": "Product Types",
  "machine_name": "product_types",
  "description": "Types of products",
  "hierarchy_depth": 1,
  "allow_multiple": false,
  "required": true,
  "weight": 2
}
```

#### Update Vocabulary
```
PUT /api/taxonomy/vocabularies/:id
```

#### Delete Vocabulary
```
DELETE /api/taxonomy/vocabularies/:id
```
Cascades to all terms in the vocabulary.

### Terms

#### Get Terms for Vocabulary
```
GET /api/taxonomy/vocabularies/:vocabularyId/terms
```
Returns all terms for a vocabulary, ordered by weight and name.

#### Create Term
```
POST /api/taxonomy/vocabularies/:vocabularyId/terms
Content-Type: application/json

{
  "name": "Technology",
  "machine_name": "technology",
  "description": "Tech-related content",
  "parent_id": null,
  "weight": 0
}
```

#### Update Term
```
PUT /api/taxonomy/terms/:id
```

#### Delete Term
```
DELETE /api/taxonomy/terms/:id
```

### Entity-Term Associations

#### Get Terms for Entity
```
GET /api/taxonomy/entities/:entityType/:entityId/terms
```
Example: `GET /api/taxonomy/entities/blog_post/550e8400-e29b-41d4-a716-446655440000/terms`

#### Set Terms for Entity
```
POST /api/taxonomy/entities/:entityType/:entityId/terms
Content-Type: application/json

{
  "termIds": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```
Replaces all existing term associations for the entity.

## Usage Examples

### Using TaxonomyField Component

The `TaxonomyField` component provides a dropdown for selecting taxonomy terms in forms.

#### By Machine Name (Recommended)
```typescript
import { TaxonomyField } from '@monorepo/shared';

<TaxonomyField
  label="Categories"
  vocabularyMachineName="categories"
  value={selectedCategories}
  onChange={setSelectedCategories}
  required
/>
```

#### By Vocabulary ID
```typescript
<TaxonomyField
  label="Tags"
  vocabularyId={tagsVocabularyId}
  value={selectedTags}
  onChange={setSelectedTags}
/>
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| label | string | Yes | Field label |
| vocabularyId | string | No* | Vocabulary UUID |
| vocabularyMachineName | string | No* | Vocabulary machine name |
| value | string \| string[] | Yes | Selected term ID(s) |
| onChange | function | Yes | Change handler |
| error | boolean | No | Show error state |
| helperText | string | No | Helper text below field |
| disabled | boolean | No | Disable the field |
| required | boolean | No | Mark as required |

*Either `vocabularyId` or `vocabularyMachineName` must be provided.

### Example: Blog Form

From `plugins/blog/frontend/components/BlogForm.tsx`:

```typescript
<TaxonomyField
  label="Categories"
  vocabularyMachineName="categories"
  value={formData.categories || []}
  onChange={(value) =>
    setFormData((prev) => ({
      ...prev,
      categories: Array.isArray(value) ? value : [value],
    }))
  }
  helperText="Select one or more categories"
/>

<TaxonomyField
  label="Tags"
  vocabularyMachineName="tags"
  value={formData.tags || []}
  onChange={(value) =>
    setFormData((prev) => ({
      ...prev,
      tags: Array.isArray(value) ? value : [value],
    }))
  }
  helperText="Add relevant tags"
/>
```

## Troubleshooting

### 404 Errors for Vocabularies

**Problem**: Console errors like `GET /api/taxonomy/vocabularies/machine-name/categories 404`

**Solution**:
1. Check if vocabularies were seeded:
   ```sql
   SELECT * FROM vocabularies;
   ```

2. Check application logs for seed messages:
   ```
   [Seed] Created "categories" vocabulary
   [Seed] Created "tags" vocabulary
   ```

3. If vocabularies don't exist, manually insert them:
   ```sql
   INSERT INTO vocabularies (name, machine_name, description, hierarchy_depth, allow_multiple, required, weight)
   VALUES
     ('Categories', 'categories', 'Content categories', 2, true, false, 0),
     ('Tags', 'tags', 'Content tags', 0, true, false, 1)
   ON CONFLICT (machine_name) DO NOTHING;
   ```

### Re-running Seed Script

The seed script runs automatically on startup. To manually trigger:

```typescript
import { seedDefaultVocabularies } from './db/seed-default-vocabularies';
import { pool } from './db';

await seedDefaultVocabularies(pool);
```

### Manually Creating Vocabularies via API

```bash
curl -X POST https://your-domain.com/api/taxonomy/vocabularies \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -d '{
    "name": "Categories",
    "machine_name": "categories",
    "description": "Content categories",
    "hierarchy_depth": 2,
    "allow_multiple": true,
    "required": false,
    "weight": 0
  }'
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Vocabulary not found" | Vocabulary doesn't exist in database | Check seed script ran successfully |
| "Failed to load vocabulary" | Network/auth error | Check JWT token is valid |
| "Failed to load terms" | Vocabulary exists but terms query failed | Check database connection |
| ERR_BLOCKED_BY_CLIENT | Ad blocker blocking API call | Whitelist your domain |

### Checking Vocabulary Existence

```sql
-- List all vocabularies
SELECT id, name, machine_name, hierarchy_depth, allow_multiple
FROM vocabularies
ORDER BY weight, name;

-- Check specific vocabulary
SELECT * FROM vocabularies WHERE machine_name = 'categories';

-- Count terms per vocabulary
SELECT
  v.name,
  v.machine_name,
  COUNT(t.id) as term_count
FROM vocabularies v
LEFT JOIN terms t ON t.vocabulary_id = v.id
GROUP BY v.id, v.name, v.machine_name
ORDER BY v.weight;
```

## Best Practices

1. **Use Machine Names**: Always use machine names (not IDs) in code for better portability
2. **Hierarchical vs Flat**: Use hierarchy only when needed (categories), keep tags flat
3. **Vocabulary Naming**: Use plural nouns (categories, tags, types) for vocabulary names
4. **Term Naming**: Use singular nouns for individual terms
5. **Weight Field**: Use weight to control display order (lower weight = higher priority)
6. **Idempotency**: Design all seed/migration scripts to be safely re-runnable
7. **Cascading Deletes**: Be aware that deleting a vocabulary cascades to all its terms

## Related Files

- **Seed Script**: `packages/main-app/src/db/seed-default-vocabularies.ts`
- **Server Integration**: `packages/main-app/src/server.ts`
- **API Routes**: `packages/main-app/src/routes/taxonomy.ts`
- **Service Layer**: `packages/main-app/src/services/TaxonomyService.ts`
- **Frontend Component**: `packages/shared/src/components/TaxonomyField.tsx`
- **Migrations**: `packages/main-app/src/db/migrations/13-create-vocabularies-table.sql`
- **Example Usage**: `plugins/blog/frontend/components/BlogForm.tsx`
