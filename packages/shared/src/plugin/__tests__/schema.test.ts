import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PLUGIN_MANIFEST_SCHEMA } from '../schema';
import type { PluginManifest } from '../manifest';
import type { PluginCapability } from '../../constants';

describe('PLUGIN_MANIFEST_SCHEMA', () => {
  let ajv: Ajv;

  beforeEach(() => {
    ajv = new Ajv({ strict: true });
    addFormats(ajv);
  });

  it('should validate a representative PluginManifest against the schema', () => {
    // Create a representative PluginManifest fixture with all required and some optional fields
    const validManifest: PluginManifest = {
      name: 'test-plugin',
      version: '1.0.0',
      displayName: 'Test Plugin',
      description: 'A test plugin for validating schema compatibility',
      author: {
        name: 'Test Author',
        email: 'test@example.com',
        url: 'https://example.com',
      },
      homepage: 'https://example.com/plugin',
      repository: {
        type: 'git',
        url: 'https://github.com/example/test-plugin',
      },
      license: 'MIT',
      keywords: ['test', 'plugin'],
      capabilities: ['database:read' as PluginCapability, 'api:call' as PluginCapability],
      hooks: {
        install: 'install.js',
        activate: 'activate.js',
      },
      dependencies: {
        'some-package': '^1.0.0',
      },
      entrypoint: 'index.js',
      frontend: {
        entrypoint: 'frontend.js',
        assets: ['style.css', 'logo.png'],
      },
      backend: {
        entrypoint: 'backend.js',
        api: [
          {
            method: 'GET',
            path: '/test',
            handler: 'handleGet',
            middleware: ['authMiddleware'],
            requiredCapabilities: ['api:call' as PluginCapability],
          },
        ],
      },
      database: {
        migrations: ['001-init.sql'],
        schemas: ['schema.json'],
      },
      settings: {
        schema: {
          apiKey: {
            type: 'string',
            label: 'API Key',
            description: 'Your API key',
            required: true,
          },
        },
        defaults: {
          apiKey: '',
        },
      },
      minimumSystemVersion: '1.0.0',
      compatibility: {
        node: '>=20.0.0',
        npm: '>=9.0.0',
      },
    };

    // Compile and validate
    const validate = ajv.compile(PLUGIN_MANIFEST_SCHEMA);
    const valid = validate(validManifest);

    // Assertion
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('should validate minimal required-only PluginManifest', () => {
    const minimalManifest: PluginManifest = {
      name: 'minimal-plugin',
      version: '1.0.0',
      displayName: 'Minimal Plugin',
      description: 'A minimal plugin with only required fields',
      author: {
        name: 'Minimal Author',
      },
      capabilities: ['database:read' as PluginCapability],
      entrypoint: 'index.js',
    };

    const validate = ajv.compile(PLUGIN_MANIFEST_SCHEMA);
    const valid = validate(minimalManifest);

    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('should reject manifest with missing required fields', () => {
    const invalidManifest = {
      name: 'invalid-plugin',
      version: '1.0.0',
      // Missing displayName, description, author, capabilities, entrypoint
    };

    const validate = ajv.compile(PLUGIN_MANIFEST_SCHEMA);
    const valid = validate(invalidManifest);

    expect(valid).toBe(false);
    expect(validate.errors).toBeTruthy();
  });

  it('should reject manifest with invalid name format', () => {
    const invalidManifest: Partial<PluginManifest> = {
      name: 'Invalid_Name', // uppercase and underscore not allowed
      version: '1.0.0',
      displayName: 'Invalid Plugin',
      description: 'Plugin with invalid name',
      author: { name: 'Author' },
      capabilities: ['database:read' as PluginCapability],
      entrypoint: 'index.js',
    };

    const validate = ajv.compile(PLUGIN_MANIFEST_SCHEMA);
    const valid = validate(invalidManifest);

    expect(valid).toBe(false);
  });
});
