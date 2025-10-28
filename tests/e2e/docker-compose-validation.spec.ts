import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as yaml from 'yaml';

test.describe('Docker Compose Production Config', () => {
  test('should have INTERNAL_GATEWAY_TOKEN in api-gateway service', () => {
    const composeFile = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    const config = yaml.parse(composeFile);

    // Check api-gateway service
    const apiGateway = config.services['api-gateway'];
    expect(apiGateway).toBeDefined();
    expect(apiGateway.environment).toBeDefined();

    // Verify INTERNAL_GATEWAY_TOKEN is present and has required syntax
    const hasInternalToken = apiGateway.environment.INTERNAL_GATEWAY_TOKEN !== undefined ||
      Object.values(apiGateway.environment || {}).some((val: unknown) =>
        typeof val === 'string' && val.includes('INTERNAL_GATEWAY_TOKEN')
      );

    expect(hasInternalToken).toBe(true);

    // Check that it uses parameter expansion with error
    const tokenValue = apiGateway.environment.INTERNAL_GATEWAY_TOKEN;
    if (typeof tokenValue === 'string') {
      expect(tokenValue).toContain('?');
      expect(tokenValue).toContain('INTERNAL_GATEWAY_TOKEN');
    }
  });

  test('should have INTERNAL_GATEWAY_TOKEN in main-app service', () => {
    const composeFile = fs.readFileSync('docker-compose.prod.yml', 'utf8');
    const config = yaml.parse(composeFile);

    // Check main-app service
    const mainApp = config.services['main-app'];
    expect(mainApp).toBeDefined();
    expect(mainApp.environment).toBeDefined();

    // Verify INTERNAL_GATEWAY_TOKEN is present and has required syntax
    const hasInternalToken = mainApp.environment.INTERNAL_GATEWAY_TOKEN !== undefined ||
      Object.values(mainApp.environment || {}).some((val: unknown) =>
        typeof val === 'string' && val.includes('INTERNAL_GATEWAY_TOKEN')
      );

    expect(hasInternalToken).toBe(true);

    // Check that it uses parameter expansion with error
    const tokenValue = mainApp.environment.INTERNAL_GATEWAY_TOKEN;
    if (typeof tokenValue === 'string') {
      expect(tokenValue).toContain('?');
      expect(tokenValue).toContain('INTERNAL_GATEWAY_TOKEN');
    }
  });
});
