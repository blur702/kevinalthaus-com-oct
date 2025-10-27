const PLUGIN_SCHEMA_PREFIX = 'plugin_';
const MAX_IDENTIFIER_LENGTH = 63;
const HASH_LENGTH = 8;
const RESERVED_SCHEMAS = ['public', 'information_schema', 'pg_catalog', 'pg_toast'];

// Cache for hash results to improve performance
const hashCache = new Map<string, string>();

/**
 * Helper function to generate a name when sanitizedTable is empty
 * Ensures the final name never exceeds MAX_IDENTIFIER_LENGTH
 */
function generateNameWithEmptyTable(sanitizedPluginId: string, hash: string): string {
  const tableToken = 't' + hash.substring(0, Math.min(4, hash.length));
  // Verify final length doesn't exceed limit
  const finalLen = sanitizedPluginId.length + 1 + tableToken.length + 1 + hash.length;
  if (finalLen > MAX_IDENTIFIER_LENGTH) {
    // Truncate plugin ID to ensure we don't overflow
    const adjustedPluginLen = MAX_IDENTIFIER_LENGTH - (1 + tableToken.length + 1 + hash.length);
    const adjustedPluginId = sanitizedPluginId.substring(0, Math.max(1, adjustedPluginLen));
    return `${adjustedPluginId}_${tableToken}_${hash}`;
  }
  return `${sanitizedPluginId}_${tableToken}_${hash}`;
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

    // Calculate actual fallback token length (1 char 't' + up to 4 chars from hash)
    const tokenLen = 1 + Math.min(4, hash.length);

    // Reserve space for: underscore (1) + token (tokenLen) + underscore (1) + hash (hash.length)
    const maxPluginLen = MAX_IDENTIFIER_LENGTH - tokenLen - hash.length - 2;
    const boundedPluginId = sanitizedPluginId.substring(0, Math.max(1, maxPluginLen));

    // Compute remaining table length and clamp to >= 0
    const maxTableLength = MAX_IDENTIFIER_LENGTH - boundedPluginId.length - hash.length - 2;
    const truncatedTable = sanitizedTable.substring(0, Math.max(0, maxTableLength));

    // If table name is empty/invalid, use the helper function
    if (truncatedTable.length === 0) {
      return generateNameWithEmptyTable(boundedPluginId, hash);
    }
    return `${boundedPluginId}_${truncatedTable}_${hash}`;
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

function generateShortHash(input: string): string {
  // Check cache first
  if (hashCache.has(input)) {
    return hashCache.get(input)!;
  }

  // Optimized hash function using FNV-1a algorithm for better distribution
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Convert to base36 using unsigned right shift to avoid edge case with most-negative 32-bit int
  const hashStr = (hash >>> 0).toString(36);
  const result = hashStr.length >= HASH_LENGTH ? hashStr.substring(0, HASH_LENGTH) : hashStr.padStart(HASH_LENGTH, '0');

  // Cache the result
  if (hashCache.size < 1000) {
    // Prevent memory leaks
    hashCache.set(input, result);
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
