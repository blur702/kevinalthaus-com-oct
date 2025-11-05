# Common SQL Queries → PostgreSQL Stored Procedures

This document identifies common SQL query patterns in the codebase that should be migrated to PostgreSQL stored procedures/functions to achieve the lean service pattern.

## Philosophy

Following the architectural directive: **Services should be 2-3 line implementations that delegate to repositories or database functions.**

Moving complex SQL to stored procedures provides:
- **Lean Services**: Services call `SELECT * FROM get_site_settings()` instead of embedding query logic
- **Centralized Logic**: Business rules in one place (database)
- **Performance**: Query plan caching, reduced network round-trips
- **Atomicity**: Complex multi-step operations become single function calls
- **Testability**: Database functions can be tested independently

## Priority 1: Settings Management

### Current Pattern (packages/main-app/src/routes/settings.ts)

**Lines 69-80: GET Settings**
```typescript
async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const result = await query<{ key: string; value: unknown }>(
    'SELECT key, value FROM system_settings WHERE key = ANY($1)',
    [keys]
  );

  const settings: Record<string, unknown> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}
```

**Lines 154-176: UPDATE Settings**
```typescript
await transaction(async (client) => {
  const updates = [
    { key: 'site_name', value: site_name },
    { key: 'site_description', value: site_description },
    // ... more keys
  ];

  for (const update of updates) {
    if (update.value !== undefined) {
      await client.query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [update.key, JSON.stringify(update.value), userId]
      );
    }
  }
});
```

### Proposed PostgreSQL Functions

**Function 1: Batch Get Settings**
```sql
CREATE OR REPLACE FUNCTION get_system_settings(setting_keys TEXT[])
RETURNS TABLE(key TEXT, value JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT s.key, s.value
  FROM system_settings s
  WHERE s.key = ANY(setting_keys);
END;
$$ LANGUAGE plpgsql STABLE;
```

**Function 2: Batch Update Settings**
```sql
CREATE OR REPLACE FUNCTION update_system_settings(
  updates JSONB,  -- Format: [{"key": "site_name", "value": "My Site"}, ...]
  user_id UUID
)
RETURNS TABLE(key TEXT, value JSONB) AS $$
DECLARE
  update_item JSONB;
BEGIN
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    INSERT INTO system_settings (key, value, updated_by, updated_at)
    VALUES (
      update_item->>'key',
      (update_item->'value')::jsonb,
      user_id,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;

  -- Return updated settings
  RETURN QUERY
  SELECT s.key, s.value
  FROM system_settings s
  WHERE s.key = ANY(
    SELECT jsonb_array_elements_text(updates) ->> 'key'
  );
END;
$$ LANGUAGE plpgsql;
```

**Service Implementation (2 lines):**
```typescript
// GET /api/settings/site
const settings = await query('SELECT * FROM get_system_settings($1)', [[keys]]);

// PUT /api/settings/site
const updated = await query('SELECT * FROM update_system_settings($1, $2)', [updatesJson, userId]);
```

---

## Priority 2: API Key Operations

### Current Pattern (packages/main-app/src/routes/settings.ts)

**Lines 709-751: GET API Keys**
```typescript
if (userRole === Role.ADMIN) {
  queryText = `
    SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
    FROM api_keys
    WHERE revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  params = [];
} else {
  queryText = `
    SELECT id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at
    FROM api_keys
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  params = [userId];
}
const result = await query<ApiKey>(queryText, params);
```

**Lines 754-831: CREATE API Key**
```typescript
const apiKey = `sk_${randomBytes(32).toString('hex')}`;
const key_prefix = apiKey.substring(0, 11);
const key_hash = hashSHA256(apiKey);

const result = await query<ApiKey>(
  `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
   RETURNING id, user_id, name, key_prefix, scopes, last_used_at, expires_at, created_at`,
  [userId, name, key_prefix, key_hash, JSON.stringify(scopes), expires_at || null]
);

// Log in audit_log
await query(
  `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
   VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
  [userId, 'api_key_created', 'api_key', keyData.id, JSON.stringify({ name, scopes })]
);
```

**Lines 834-903: REVOKE API Key**
```typescript
const keyResult = await query<{ user_id: string; name: string }>(
  'SELECT user_id, name FROM api_keys WHERE id = $1 AND revoked_at IS NULL',
  [id]
);

if (keyData.user_id !== userId && userRole !== Role.ADMIN) {
  res.status(403).json({ error: 'Not authorized to revoke this API key' });
  return;
}

await query(
  'UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
  [id]
);

await query(
  `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
   VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
  [userId, 'api_key_revoked', 'api_key', id, JSON.stringify({ name: keyData.name })]
);
```

### Proposed PostgreSQL Functions

**Function 1: Get API Keys**
```sql
CREATE OR REPLACE FUNCTION get_api_keys(
  requesting_user_id UUID,
  requesting_user_role TEXT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name TEXT,
  key_prefix TEXT,
  scopes JSONB,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
) AS $$
BEGIN
  IF requesting_user_role = 'admin' THEN
    -- Admins see all keys
    RETURN QUERY
    SELECT a.id, a.user_id, a.name, a.key_prefix, a.scopes,
           a.last_used_at, a.expires_at, a.created_at
    FROM api_keys a
    WHERE a.revoked_at IS NULL
    ORDER BY a.created_at DESC;
  ELSE
    -- Users see only their own keys
    RETURN QUERY
    SELECT a.id, a.user_id, a.name, a.key_prefix, a.scopes,
           a.last_used_at, a.expires_at, a.created_at
    FROM api_keys a
    WHERE a.user_id = requesting_user_id AND a.revoked_at IS NULL
    ORDER BY a.created_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Function 2: Create API Key (with audit logging)**
```sql
CREATE OR REPLACE FUNCTION create_api_key(
  p_user_id UUID,
  p_name TEXT,
  p_key_prefix TEXT,
  p_key_hash TEXT,
  p_scopes JSONB,
  p_expires_at TIMESTAMP DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  name TEXT,
  key_prefix TEXT,
  scopes JSONB,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP
) AS $$
DECLARE
  new_key_id UUID;
BEGIN
  -- Insert API key
  INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at, created_at, updated_at)
  VALUES (p_user_id, p_name, p_key_prefix, p_key_hash, p_scopes, p_expires_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING api_keys.id INTO new_key_id;

  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
  VALUES (
    p_user_id,
    'api_key_created',
    'api_key',
    new_key_id,
    jsonb_build_object('name', p_name, 'scopes', p_scopes),
    CURRENT_TIMESTAMP
  );

  -- Return created key
  RETURN QUERY
  SELECT a.id, a.user_id, a.name, a.key_prefix, a.scopes, a.last_used_at, a.expires_at, a.created_at
  FROM api_keys a
  WHERE a.id = new_key_id;
END;
$$ LANGUAGE plpgsql;
```

**Function 3: Revoke API Key (with authorization check)**
```sql
CREATE OR REPLACE FUNCTION revoke_api_key(
  p_key_id UUID,
  p_requesting_user_id UUID,
  p_requesting_user_role TEXT
)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  key_owner_id UUID;
  key_name TEXT;
BEGIN
  -- Get key details
  SELECT user_id, name INTO key_owner_id, key_name
  FROM api_keys
  WHERE id = p_key_id AND revoked_at IS NULL;

  -- Check if key exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'API key not found'::TEXT;
    RETURN;
  END IF;

  -- Authorization check: user must own the key OR be admin
  IF key_owner_id != p_requesting_user_id AND p_requesting_user_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 'Not authorized to revoke this API key'::TEXT;
    RETURN;
  END IF;

  -- Revoke the key (soft delete)
  UPDATE api_keys
  SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_key_id;

  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
  VALUES (
    p_requesting_user_id,
    'api_key_revoked',
    'api_key',
    p_key_id,
    jsonb_build_object('name', key_name),
    CURRENT_TIMESTAMP
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;
```

**Service Implementation (1-2 lines each):**
```typescript
// GET /api/settings/api-keys
const keys = await query('SELECT * FROM get_api_keys($1, $2)', [userId, userRole]);

// POST /api/settings/api-keys
const apiKey = `sk_${randomBytes(32).toString('hex')}`;
const keyHash = hashSHA256(apiKey);
const created = await query('SELECT * FROM create_api_key($1, $2, $3, $4, $5, $6)',
  [userId, name, apiKey.substring(0, 11), keyHash, JSON.stringify(scopes), expiresAt]);

// DELETE /api/settings/api-keys/:id
const result = await query('SELECT * FROM revoke_api_key($1, $2, $3)', [id, userId, userRole]);
if (!result.rows[0].success) {
  return res.status(403).json({ error: result.rows[0].error_message });
}
```

---

## Priority 3: User Authentication & Queries

### Current Pattern (packages/main-app/src/auth/index.ts)

**Repeated Pattern:**
```typescript
const result = await query<User>(
  'SELECT id, email, username, password_hash, role FROM users WHERE email = $1',
  [email]
);
```

**Repeated in multiple places:**
- Login flow (line ~161)
- Password reset (line ~500)
- User validation

### Proposed PostgreSQL Function

```sql
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE(
  id UUID,
  email TEXT,
  username TEXT,
  password_hash TEXT,
  role TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.username, u.password_hash, u.role, u.created_at, u.updated_at
  FROM users u
  WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_user_by_id(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  username TEXT,
  role TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.username, u.role, u.created_at, u.updated_at
  FROM users u
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Service Implementation:**
```typescript
const user = await query('SELECT * FROM get_user_by_email($1)', [email]);
const user = await query('SELECT * FROM get_user_by_id($1)', [userId]);
```

---

## Priority 4: Audit Logging

### Current Pattern (Scattered Across Codebase)

**Repeated INSERT:**
```typescript
await query(
  `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
   VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
  [userId, action, resourceType, resourceId, JSON.stringify(details)]
);
```

### Proposed PostgreSQL Function

```sql
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, created_at)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_details, CURRENT_TIMESTAMP)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql;
```

**Service Implementation (1 line):**
```typescript
await query('SELECT log_audit_event($1, $2, $3, $4, $5)',
  [userId, 'api_key_created', 'api_key', keyId, { name, scopes }]);
```

---

## Migration Strategy

### Phase 1: Create Functions (Non-Breaking)
1. Create all PostgreSQL functions alongside existing queries
2. Test functions independently with `SELECT * FROM function_name(...)`
3. Verify performance with `EXPLAIN ANALYZE`

### Phase 2: Update Services (Breaking)
1. Replace inline queries with function calls in services
2. Update unit tests to mock function calls
3. Run integration tests to verify behavior

### Phase 3: Remove Old Patterns
1. Search codebase for remaining inline SQL
2. Migrate any remaining queries to functions
3. Document all available database functions

---

## Performance Considerations

### Query Plan Caching
PostgreSQL caches query plans for prepared statements and functions, providing significant performance benefits for frequently-called operations.

### Reduced Network Round-Trips
Multi-step operations (e.g., API key creation + audit log) become single function calls.

### Transaction Safety
Functions handle their own transaction boundaries, ensuring atomic operations.

---

## Testing Functions

### Example Test Pattern
```sql
-- Test get_system_settings
BEGIN;
  INSERT INTO system_settings (key, value, updated_by)
  VALUES ('test_key', '"test_value"'::jsonb, 'test-user-id');

  SELECT * FROM get_system_settings(ARRAY['test_key']);
  -- Expected: Returns row with key='test_key', value='"test_value"'
ROLLBACK;

-- Test update_system_settings
BEGIN;
  SELECT * FROM update_system_settings(
    '[{"key": "test_key", "value": "new_value"}]'::jsonb,
    'test-user-id'::uuid
  );

  SELECT value FROM system_settings WHERE key = 'test_key';
  -- Expected: Returns '"new_value"'
ROLLBACK;
```

---

## Summary

Moving these common SQL patterns to stored procedures will:
- ✅ Achieve the lean service pattern (2-3 lines per operation)
- ✅ Centralize business logic in the database
- ✅ Improve performance through query plan caching
- ✅ Reduce code duplication
- ✅ Simplify testing and maintenance

Next step: Implement Priority 1 (Settings Management) as a proof of concept.
