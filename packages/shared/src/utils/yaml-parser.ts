import yaml from 'js-yaml';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { PluginManifest } from '../plugin/manifest';
import { PLUGIN_MANIFEST_SCHEMA } from '../plugin/schema';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

// Module-level compiled validator to avoid recompilation on each call
const manifestValidator: ValidateFunction<PluginManifest> = ajv.compile(PLUGIN_MANIFEST_SCHEMA);

export class YAMLParseError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'YAMLParseError';
  }
}

export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: unknown[]
  ) {
    super(message);
    this.name = 'ManifestValidationError';
  }
}

export function parseYAML<T = unknown>(content: string): T {
  try {
    const parsed = yaml.load(content, {
      schema: yaml.JSON_SCHEMA,
      json: true,
    });

    if (parsed === null || parsed === undefined) {
      throw new YAMLParseError('YAML content is empty or invalid');
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof YAMLParseError) {
      throw error;
    }

    throw new YAMLParseError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

export function stringifyYAML(data: unknown, options?: yaml.DumpOptions): string {
  try {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
      sortKeys: true,
      ...options,
    });
  } catch (error) {
    throw new YAMLParseError(
      `Failed to stringify YAML: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

export function parsePluginManifest(content: string): PluginManifest {
  const parsed = parseYAML<PluginManifest>(content);
  return validatePluginManifest(parsed);
}

export function validatePluginManifest(data: unknown): PluginManifest {
  if (!manifestValidator(data)) {
    throw new ManifestValidationError(
      'Plugin manifest validation failed',
      manifestValidator.errors || []
    );
  }

  return data as PluginManifest;
}

export function createManifestValidator(): ValidateFunction<PluginManifest> {
  return manifestValidator;
}

export function safeParseYAML<T = unknown>(content: string): { success: true; data: T } | { success: false; error: Error } {
  try {
    const data = parseYAML<T>(content);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function safeParsePluginManifest(content: string): { success: true; manifest: PluginManifest } | { success: false; error: Error } {
  try {
    const manifest = parsePluginManifest(content);
    return { success: true, manifest };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function validateYAMLStructure(content: string): boolean {
  try {
    parseYAML(content);
    return true;
  } catch {
    return false;
  }
}

export const YAMLParser = {
  parse: parseYAML,
  stringify: stringifyYAML,
  parseManifest: parsePluginManifest,
  validateManifest: validatePluginManifest,
  safeParse: safeParseYAML,
  safeParseManifest: safeParsePluginManifest,
  validateStructure: validateYAMLStructure,
};
