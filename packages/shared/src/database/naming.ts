const PLUGIN_SCHEMA_PREFIX = 'plugin_';
const MAX_IDENTIFIER_LENGTH = 63;
const HASH_LENGTH = 8;
const RESERVED_SCHEMAS = ['public', 'information_schema', 'pg_catalog', 'pg_toast'];

// Cache for hash results to improve performance
const hashCache = new Map<string, string>();

/**
 * Naming strategy selection
 * BREAKING CHANGE: The FNV-1a hash algorithm generates different identifiers than the legacy implementation.
 * This will affect all plugin schemas and tables created with the previous hash.
 *
 * To maintain backward compatibility with existing deployments:
 * - Set NAMING_STRATEGY=legacy (or leave unset) to use the original hash implementation
 * - Set NAMING_STRATEGY=fnv1a to use the new FNV-1a algorithm (better distribution)
 *
 * When migrating from legacy to fnv1a, you MUST rename all existing plugin schemas and tables.
 * See migration guide in docs/migrations/naming-strategy-v2.md
 */
type NamingStrategy = 'legacy' | 'fnv1a';
const NAMING_STRATEGY: NamingStrategy = (process.env.NAMING_STRATEGY as NamingStrategy) || 'legacy';

/**
 * Helper function to generate a name when sanitizedTable is empty
 * Ensures the final name never exceeds MAX_IDENTIFIER_LENGTH
 */
function generateNameWithEmptyTable(sanitizedPluginId: string, hash: string): string {
  // Handle empty sanitizedPluginId by using a hash-based prefix to avoid collisions
  let effectivePluginId: string;
  if (sanitizedPluginId.length > 0) {
    effectivePluginId = sanitizedPluginId;
  } else {
    // Use deterministic hash-based prefix instead of literal 'plugin'
    const hashPrefix = 'p' + hash.substring(0, Math.min(3, hash.length));
    effectivePluginId = hashPrefix;
  }

  const tableToken = 't' + hash.substring(0, Math.min(4, hash.length));
  // Verify final length doesn't exceed limit
  const finalLen = effectivePluginId.length + 1 + tableToken.length + 1 + hash.length;
  if (finalLen > MAX_IDENTIFIER_LENGTH) {
    // Truncate plugin ID to ensure we don't overflow
    const adjustedPluginLen = MAX_IDENTIFIER_LENGTH - (1 + tableToken.length + 1 + hash.length);
    const adjustedPluginId = effectivePluginId.substring(0, Math.max(1, adjustedPluginLen));
    return `${adjustedPluginId}_${tableToken}_${hash}`;
  }
  return `${effectivePluginId}_${tableToken}_${hash}`;
}

export function generatePluginSchemaName(pluginId: string): string {
  const sanitized = sanitizeIdentifier(pluginId);
  const schemaName = `${PLUGIN_SCHEMA_PREFIX}${sanitized}`;

  if (schemaName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(pluginId);
    const truncated = sanitized.substring(
      0,
      MAX_IDENTIFIER_LENGTH - PLUGIN_SCHEMA_PREFIX.length - hash.length - 1
    );
    return `${PLUGIN_SCHEMA_PREFIX}${truncated}_${hash}`;
  }

  return schemaName;
}

export function generatePluginTableName(pluginId: string, tableName: string): string {
  const sanitizedPluginId = sanitizeIdentifier(pluginId);
  const sanitizedTable = sanitizeIdentifier(tableName);

  // Handle empty sanitizedTable to avoid collisions
  // Include the original tableName in hash input so different invalid names produce different hashes
  const hashInput = sanitizedTable.length === 0
    ? `${sanitizedPluginId}_${tableName}`
    : `${sanitizedPluginId}_${sanitizedTable}`;

  const fullName = `${sanitizedPluginId}_${sanitizedTable}`;

  if (fullName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(hashInput);

    // First, try to fit with non-empty table (format: pluginId_table_hash)
    // Reserve space for table, but estimate how much we can allocate
    // We need: pluginId + '_' + table + '_' + hash
    // If sanitizedTable is long enough, try to use some of it
    const minTableReserve = Math.min(sanitizedTable.length, 8); // Reserve at least some table chars if available
    const tentativeMaxPluginLen = MAX_IDENTIFIER_LENGTH - 1 - minTableReserve - 1 - hash.length;
    const tentativeBoundedPluginId = sanitizedPluginId.substring(0, Math.max(1, tentativeMaxPluginLen));

    // Now compute actual remaining space for table
    const maxTableLength = MAX_IDENTIFIER_LENGTH - tentativeBoundedPluginId.length - 1 - hash.length - 1;
    const truncatedTable = sanitizedTable.substring(0, Math.max(0, maxTableLength));

    // If table name is empty/invalid after truncation, use fallback with token
    if (truncatedTable.length === 0) {
      // Fallback path: compute plugin budget reserving space for token
      const tokenLen = 1 + Math.min(4, hash.length);
      const maxPluginLenFallback = MAX_IDENTIFIER_LENGTH - tokenLen - hash.length - 2;
      const boundedPluginIdFallback = sanitizedPluginId.substring(0, Math.max(1, maxPluginLenFallback));
      return generateNameWithEmptyTable(boundedPluginIdFallback, hash);
    }

    // Non-fallback path: use computed plugin and table
    return `${tentativeBoundedPluginId}_${truncatedTable}_${hash}`;
  }

  // Handle empty sanitizedTable in non-truncated case
  if (sanitizedTable.length === 0) {
    const hash = generateShortHash(hashInput);
    return generateNameWithEmptyTable(sanitizedPluginId, hash);
  }

  return fullName;
}

export function sanitizeIdentifier(identifier: string): string {
  return identifier
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function isReservedSchema(schemaName: string): boolean {
  return RESERVED_SCHEMAS.includes(schemaName.toLowerCase());
}

export function isPluginSchema(schemaName: string): boolean {
  return schemaName.startsWith(PLUGIN_SCHEMA_PREFIX);
}

export function extractPluginIdFromSchema(schemaName: string): string | null {
  if (!isPluginSchema(schemaName)) {
    return null;
  }

  return schemaName.substring(PLUGIN_SCHEMA_PREFIX.length);
}

export function validateIdentifier(identifier: string): boolean {
  if (!identifier || identifier.length === 0) {
    return false;
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    return false;
  }

  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    return false;
  }

  return true;
}

export function generateIndexName(tableName: string, columns: string[]): string {
  const columnPart = columns.join('_');
  const indexName = `idx_${tableName}_${columnPart}`;

  if (indexName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(indexName);
    const maxLength = MAX_IDENTIFIER_LENGTH - hash.length - 1;
    return `${indexName.substring(0, maxLength)}_${hash}`;
  }

  return indexName;
}

export function generateForeignKeyName(
  tableName: string,
  referencedTable: string,
  columns: string[]
): string {
  const columnPart = columns.join('_');
  const fkName = `fk_${tableName}_${referencedTable}_${columnPart}`;

  if (fkName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(fkName);
    const maxLength = MAX_IDENTIFIER_LENGTH - hash.length - 1;
    return `${fkName.substring(0, maxLength)}_${hash}`;
  }

  return fkName;
}

/**
 * Legacy hash implementation (original)
 * Simple character code sum with modulo
 */
function generateShortHashLegacy(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash + input.charCodeAt(i)) % 2147483647;
  }
  const hashStr = hash.toString(36);
  return hashStr.length >= HASH_LENGTH ? hashStr.substring(0, HASH_LENGTH) : hashStr.padStart(HASH_LENGTH, '0');
}

/**
 * FNV-1a hash implementation (improved distribution)
 * Better collision resistance than legacy
 */
function generateShortHashFnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to base36 using unsigned right shift to avoid edge case with most-negative 32-bit int
  const hashStr = (hash >>> 0).toString(36);
  return hashStr.length >= HASH_LENGTH ? hashStr.substring(0, HASH_LENGTH) : hashStr.padStart(HASH_LENGTH, '0');
}

/**
 * Generate a short hash using the configured naming strategy
 */
function generateShortHash(input: string): string {
  // Check cache first
  const cacheKey = `${NAMING_STRATEGY}:${input}`;
  if (hashCache.has(cacheKey)) {
    return hashCache.get(cacheKey)!;
  }

  // Select hash implementation based on strategy
  const result = NAMING_STRATEGY === 'fnv1a'
    ? generateShortHashFnv1a(input)
    : generateShortHashLegacy(input);

  // Cache the result
  if (hashCache.size < 1000) {
    // Prevent memory leaks
    hashCache.set(cacheKey, result);
  }

  return result;
}

export const DatabaseNaming = {
  generatePluginSchemaName,
  generatePluginTableName,
  sanitizeIdentifier,
  isReservedSchema,
  isPluginSchema,
  extractPluginIdFromSchema,
  validateIdentifier,
  generateIndexName,
  generateForeignKeyName,
};
