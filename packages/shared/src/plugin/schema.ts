// Plugin schema validation using JSON Schema
import type { JSONSchemaType } from 'ajv';
import type { PluginManifest } from './manifest';

// Double cast below is required due to ajv's JSONSchemaType limitations:
// - Cannot properly type nullable fields in complex nested objects (e.g., author.email, repository)
// - Struggles with union types and deeply nested optional structures (e.g., frontend, backend, database)
// - additionalProperties: true/false conflicts with strict index signature requirements
// A direct JSONSchemaType<PluginManifest> causes TS2322/TS2344 errors on nested nullable/optional properties.
// TODO: Revisit if ajv improves typing for complex schemas or consider alternative validation approach (ticket: PLUGIN-SCHEMA-TYPES).
// Test coverage: see packages/shared/src/plugin/__tests__/schema.test.ts for runtime validation against PluginManifest type.
export const PLUGIN_MANIFEST_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      minLength: 3,
      maxLength: 50,
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-z0-9.-]+)?(\\+[a-z0-9.-]+)?$',
    },
    displayName: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
    },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email', nullable: true },
        url: { type: 'string', format: 'uri', nullable: true },
      },
      required: ['name'],
    },
    homepage: {
      type: 'string',
      format: 'uri',
      nullable: true,
    },
    repository: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        url: { type: 'string', format: 'uri' },
      },
      required: ['type', 'url'],
      nullable: true,
    },
    license: {
      type: 'string',
      nullable: true,
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'database:read',
          'database:write',
          'api:call',
          'theme:modify',
          'settings:read',
          'settings:write',
        ],
      },
      minItems: 1,
    },
    hooks: {
      type: 'object',
      properties: {
        install: { type: 'string', nullable: true },
        activate: { type: 'string', nullable: true },
        deactivate: { type: 'string', nullable: true },
        uninstall: { type: 'string', nullable: true },
        update: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    dependencies: {
      type: 'object',
      additionalProperties: { type: 'string' },
      required: [],
      nullable: true,
    },
    entrypoint: {
      type: 'string',
      minLength: 1,
    },
    frontend: {
      type: 'object',
      properties: {
        entrypoint: { type: 'string' },
        assets: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
      required: ['entrypoint'],
      nullable: true,
    },
    backend: {
      type: 'object',
      properties: {
        entrypoint: { type: 'string' },
        api: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
              },
              path: { type: 'string' },
              handler: { type: 'string' },
              middleware: {
                type: 'array',
                items: { type: 'string' },
                nullable: true,
              },
              requiredCapabilities: {
                type: 'array',
                items: { type: 'string' },
                nullable: true,
              },
            },
            required: ['method', 'path', 'handler'],
          },
          nullable: true,
        },
      },
      required: ['entrypoint'],
      nullable: true,
    },
    database: {
      type: 'object',
      properties: {
        migrations: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        schemas: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
      nullable: true,
    },
    settings: {
      type: 'object',
      properties: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        defaults: {
          type: 'object',
          additionalProperties: true,
          nullable: true,
        },
      },
      required: ['schema'],
      nullable: true,
    },
    minimumSystemVersion: {
      type: 'string',
      nullable: true,
    },
    compatibility: {
      type: 'object',
      properties: {
        node: { type: 'string', nullable: true },
        npm: { type: 'string', nullable: true },
      },
      nullable: true,
    },
  },
  required: [
    'name',
    'version',
    'displayName',
    'description',
    'author',
    'capabilities',
    'entrypoint',
  ],
  additionalProperties: false,
  // Double cast required due to ajv's JSONSchemaType limitations (see comment at top of file).
  // Test coverage: see packages/shared/src/plugin/__tests__/schema.test.ts
} as unknown as JSONSchemaType<PluginManifest>;

export const PLUGIN_SETTINGS_FIELD_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['string', 'number', 'boolean', 'array', 'object'],
    },
    label: { type: 'string', minLength: 1 },
    description: { type: 'string', nullable: true },
    required: { type: 'boolean', nullable: true },
    default: { nullable: true },
    validation: {
      type: 'object',
      properties: {
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true },
        pattern: { type: 'string', nullable: true },
        enum: { type: 'array', nullable: true },
      },
      nullable: true,
    },
  },
  required: ['type', 'label'],
};
