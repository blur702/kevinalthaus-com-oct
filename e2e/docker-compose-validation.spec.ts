import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as yaml from 'yaml';

interface DockerComposeService {
  environment?: Record<string, string | undefined>;
  [key: string]: unknown;
}

interface DockerComposeConfig {
  services: Record<string, DockerComposeService>;
  [key: string]: unknown;
}

test.describe('Docker Compose Production Config', () => {
  test('should have INTERNAL_GATEWAY_TOKEN in api-gateway service', () => {
    const composeFile = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    const config = yaml.parse(composeFile) as DockerComposeConfig;

    // Check api-gateway service
    const apiGateway = config.services['api-gateway'];
    expect(apiGateway).toBeDefined();
    expect(apiGateway.environment).toBeDefined();

    // Verify INTERNAL_GATEWAY_TOKEN is present and has required syntax
    const environment = apiGateway.environment || {};
    const hasInternalToken = environment.INTERNAL_GATEWAY_TOKEN !== undefined ||
      Object.values(environment).some((val: string | undefined) =>
        typeof val === 'string' && val.includes('INTERNAL_GATEWAY_TOKEN')
      );

    expect(hasInternalToken).toBe(true);

    // Check that it uses parameter expansion with error
    const tokenValue = environment.INTERNAL_GATEWAY_TOKEN;
    if (typeof tokenValue === 'string') {
      expect(tokenValue).toContain('?');
      expect(tokenValue).toContain('INTERNAL_GATEWAY_TOKEN');
    }
  });

  test('should have INTERNAL_GATEWAY_TOKEN in main-app service', () => {
    const composeFile = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    const config = yaml.parse(composeFile) as DockerComposeConfig;

    // Check main-app service
    const mainApp = config.services['main-app'];
    expect(mainApp).toBeDefined();
    expect(mainApp.environment).toBeDefined();

    // Verify INTERNAL_GATEWAY_TOKEN is present and has required syntax
    const environment = mainApp.environment || {};
    const hasInternalToken = environment.INTERNAL_GATEWAY_TOKEN !== undefined ||
      Object.values(environment).some((val: string | undefined) =>
        typeof val === 'string' && val.includes('INTERNAL_GATEWAY_TOKEN')
      );

    expect(hasInternalToken).toBe(true);

    // Check that it uses parameter expansion with error
    const tokenValue = environment.INTERNAL_GATEWAY_TOKEN;
    if (typeof tokenValue === 'string') {
      expect(tokenValue).toContain('?');
      expect(tokenValue).toContain('INTERNAL_GATEWAY_TOKEN');
    }
  });
});
