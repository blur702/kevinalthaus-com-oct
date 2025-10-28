import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';

test.describe('CORS Startup Validation', () => {
  test('should fail to start with wildcard CORS and credentials enabled', async () => {
    // Start a process with invalid CORS configuration
    const env = {
      ...process.env,
      CORS_ORIGIN: '*',
      CORS_CREDENTIALS: 'true',
      PORT: '3099', // Use a different port to avoid conflicts
    };

    const mainAppPath = 'packages/main-app/src/index.ts';

    // Spawn the process
    const proc = spawn('npx', ['tsx', mainAppPath], {
      env,
      stdio: 'pipe',
    });

    let stderr = '';
    let exitCode: number | null = null;
    let timedOut = false;

    // Collect stderr
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      let resolved = false;

      proc.on('exit', (code) => {
        if (!resolved) {
          exitCode = code;
          resolved = true;
          resolve();
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          timedOut = true;
          proc.kill();
          resolved = true;
          resolve();
        }
      }, 10000);
    });

    // Verify the test didn't timeout
    expect(timedOut).toBe(false);

    // Verify the process exited with error code 1 (only when not timed out)
    if (!timedOut) {
      expect(exitCode).toBe(1);
    }

    // Verify the error message was logged
    expect(stderr).toContain('FATAL: Invalid CORS configuration detected');
    expect(stderr).toContain('CORS_ORIGIN includes wildcard (*)');
    expect(stderr).toContain('CORS_CREDENTIALS is true');
  });

  test('should start successfully with valid CORS configuration', async () => {
    // Start a process with valid CORS configuration
    const env = {
      ...process.env,
      CORS_ORIGIN: 'http://localhost:3002,http://localhost:3003',
      CORS_CREDENTIALS: 'true',
      PORT: '3098', // Use a different port
    };

    const mainAppPath = 'packages/main-app/src/index.ts';

    const proc = spawn('npx', ['tsx', mainAppPath], {
      env,
      stdio: 'pipe',
    });

    let stdout = '';
    let startedSuccessfully = false;

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes('Server running on port') || stdout.includes('listening')) {
        startedSuccessfully = true;
        proc.kill(); // Kill after confirming it started
      }
    });

    // Wait up to 15 seconds for startup
    await new Promise<void>((resolve) => {
      proc.on('exit', () => {
        resolve();
      });

      setTimeout(() => {
        proc.kill();
        resolve();
      }, 15000);
    });

    // Verify it started successfully
    expect(startedSuccessfully).toBe(true);
  });
});
