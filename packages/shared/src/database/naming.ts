const PLUGIN_SCHEMA_PREFIX = 'plugin_';
const MAX_IDENTIFIER_LENGTH = 63;
const RESERVED_SCHEMAS = ['public', 'information_schema', 'pg_catalog', 'pg_toast'];

// Cache for hash results to improve performance
const hashCache = new Map<string, string>();

export function generatePluginSchemaName(pluginId: string): string {
  const sanitized = sanitizeIdentifier(pluginId);
  const schemaName = `${PLUGIN_SCHEMA_PREFIX}${sanitized}`;

  if (schemaName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(pluginId);
    const truncated = sanitized.substring(0, MAX_IDENTIFIER_LENGTH - PLUGIN_SCHEMA_PREFIX.length - hash.length - 1);
    return `${PLUGIN_SCHEMA_PREFIX}${truncated}_${hash}`;
  }

  return schemaName;
}

export function generatePluginTableName(pluginId: string, tableName: string): string {
  const sanitizedPluginId = sanitizeIdentifier(pluginId);
  const sanitizedTable = sanitizeIdentifier(tableName);
  const fullName = `${sanitizedPluginId}_${sanitizedTable}`;

  if (fullName.length > MAX_IDENTIFIER_LENGTH) {
    const hash = generateShortHash(fullName);
    const maxTableLength = MAX_IDENTIFIER_LENGTH - sanitizedPluginId.length - hash.length - 2;
    const truncatedTable = sanitizedTable.substring(0, maxTableLength);
    return `${sanitizedPluginId}_${truncatedTable}_${hash}`;
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
  
  const result = Math.abs(hash).toString(36).substring(0, 8);
  
  // Cache the result
  if (hashCache.size < 1000) { // Prevent memory leaks
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
