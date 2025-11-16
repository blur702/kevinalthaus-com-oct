import * as fs from 'fs';
import * as path from 'path';
import { ServerMonitor, ServerConfig } from './server-monitor';

// Parse command-line arguments
const args = process.argv.slice(2);
const flags = {
  smoke: args.includes('--smoke'),
  ui: args.includes('--ui'),
  api: args.includes('--api'),
  all: args.includes('--all'),
  watch: args.includes('--watch'),
  help: args.includes('--help') || args.includes('-h')
};

// Display help
if (flags.help) {
  console.log(`
Authentication Test Runner with Console Monitoring

Usage: npm run test:auth:[smoke|ui|api|all|watch]

Flags:
  --smoke      Run smoke authentication tests (tests/e2e/comp_auth.spec.ts)
  --ui         Run UI authentication tests (e2e/auth.spec.ts)
  --api        Run API authentication tests (e2e/api-auth.spec.ts)
  --all        Run all authentication tests
  --watch      Run tests in watch mode (re-run on file changes)
  --help, -h   Display this help message

Examples:
  npm run test:auth:smoke       # Run smoke tests
  npm run test:auth:all         # Run all auth tests
  npm run test:auth:watch       # Run in watch mode

Output:
  - Console errors logged to: test-results/console-errors.log
  - Test results in: test-results/
  - Cycle report: AUTH_TEST_CYCLE_REPORT.md
`);
  process.exit(0);
}

// Determine which tests to run
let testFiles: string[] = [];
if (flags.smoke) {
  testFiles.push('tests/e2e/comp_auth.spec.ts');
} else if (flags.ui) {
  testFiles.push('e2e/auth.spec.ts');
} else if (flags.api) {
  testFiles.push('e2e/api-auth.spec.ts');
} else if (flags.all) {
  testFiles.push('e2e/auth.spec.ts', 'e2e/api-auth.spec.ts', 'tests/e2e/comp_auth.spec.ts');
} else {
  // Default to smoke tests
  testFiles.push('tests/e2e/comp_auth.spec.ts');
}

console.log('\n========================================');
console.log('Authentication Test Runner');
console.log('========================================\n');
console.log(`Running tests: ${testFiles.join(', ')}`);
console.log(`Watch mode: ${flags.watch ? 'enabled' : 'disabled'}\n`);

// Setup paths
const rootDir = process.cwd();
const testResultsDir = path.join(rootDir, 'test-results');
const consoleErrorsLog = path.join(testResultsDir, 'console-errors.log');

// Create test-results directory if it doesn't exist
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
  console.log(`Created test-results directory: ${testResultsDir}`);
}

// Initialize console errors log file
const logStream = fs.createWriteStream(consoleErrorsLog, { flags: 'w' });
const startTime = new Date().toISOString();

logStream.write(`========================================\n`);
logStream.write(`Authentication Test Execution\n`);
logStream.write(`Started: ${startTime}\n`);
logStream.write(`Tests: ${testFiles.join(', ')}\n`);
logStream.write(`========================================\n\n`);

console.log(`Console errors will be logged to: ${consoleErrorsLog}\n`);

// Server configurations
const serverConfigs: ServerConfig[] = [
  {
    name: 'API Gateway',
    command: 'npm',
    args: ['run', 'dev', '--workspace=@monorepo/api-gateway'],
    port: 3000,
    env: {},
    healthPath: '/health'
  },
  {
    name: 'Main App',
    command: 'npm',
    args: ['run', 'dev', '--workspace=@monorepo/main-app'],
    port: 3003,
    env: {},
    healthPath: '/health'
  },
  {
    name: 'Admin',
    command: 'npm',
    args: ['run', 'dev', '--workspace=@monorepo/admin'],
    port: 3002,
    env: {},
    healthPath: '/'  // Admin might not have /health endpoint
  },
  {
    name: 'Plugin Engine',
    command: 'npm',
    args: ['run', 'dev', '--workspace=@monorepo/plugin-engine'],
    port: 3004,
    env: {},
    healthPath: '/health'
  }
];

// Start servers and run tests
async function main() {
  const servers: ServerMonitor[] = [];

  try {
    // Start all servers
    console.log('Starting servers...\n');

    for (const config of serverConfigs) {
      const monitor = new ServerMonitor(config, logStream);
      await monitor.startServer();
      servers.push(monitor);
    }

    // Wait for all servers to be ready
    console.log('\nWaiting for servers to be ready...\n');

    for (const monitor of servers) {
      await monitor.waitForReady(60000); // 60 second timeout
    }

    console.log('\n========================================');
    console.log('All servers ready! Starting tests...');
    console.log('========================================\n');

    // Run Playwright tests
    await runPlaywrightTests(testFiles, flags.watch);

  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR: Test execution failed');
    console.error('========================================\n');
    console.error(error);

    logStream.write(`\n[${new Date().toISOString()}] [TEST-RUNNER] [ERROR] Test execution failed: ${error}\n`);

    // Rethrow the error to be handled by the top-level catch after cleanup
    throw error;
  } finally {
    // Stop all servers
    console.log('\n========================================');
    console.log('Stopping servers...');
    console.log('========================================\n');

    for (const monitor of servers) {
      await monitor.stop();
    }

    // Close log stream
    const endTime = new Date().toISOString();
    logStream.write(`\n========================================\n`);
    logStream.write(`Test execution completed: ${endTime}\n`);
    logStream.write(`========================================\n`);
    logStream.end();

    console.log('\n========================================');
    console.log('Test execution complete');
    console.log('========================================\n');
    console.log(`Console errors logged to: ${consoleErrorsLog}`);
    console.log(`Review AUTH_TEST_CYCLE_REPORT.md for detailed results\n`);
  }
}

/**
 * Run Playwright tests using npx playwright test
 */
async function runPlaywrightTests(testFiles: string[], watch: boolean): Promise<void> {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const playwrightArgs = [
      'playwright',
      'test',
      ...testFiles,
      '--reporter=list,json',
      `--output=test-results`
    ];

    if (watch) {
      playwrightArgs.push('--watch');
    }

    console.log(`Running: npx ${playwrightArgs.join(' ')}\n`);

    const playwrightProcess = spawn('npx', playwrightArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        E2E_TESTING: 'true',
        CONSOLE_MONITORING: 'true',
        CONSOLE_LOG_PATH: consoleErrorsLog
      }
    });

    playwrightProcess.on('exit', (code: number) => {
      if (code === 0) {
        console.log('\n✅ All tests passed!');
        resolve();
      } else {
        console.error(`\n❌ Tests failed with exit code ${code}`);

        // In watch mode, resolve with success to allow cleanup, but log the failure
        // In non-watch mode, reject so cleanup can happen and error propagates
        if (watch) {
          console.log('\nWatching for file changes...\n');
          // Resolve instead of leaving promise pending in watch mode
          resolve();
        } else {
          reject(new Error(`Playwright tests failed with exit code ${code}`));
        }
      }
    });

    playwrightProcess.on('error', (error: Error) => {
      console.error('\n❌ Failed to start Playwright tests:', error);
      reject(error);
    });
  });
}

// Track if shutdown is in progress
let isShuttingDown = false;

// Handle process termination
process.on('SIGINT', () => {
  if (isShuttingDown) {
    console.log('\n\nForce shutdown requested...');
    process.exit(1);
    return;
  }

  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  console.log('(Press Ctrl+C again to force shutdown)\n');
  isShuttingDown = true;

  // Allow main() to complete its finally block
  // The process will exit naturally after cleanup
});

process.on('SIGTERM', () => {
  if (isShuttingDown) {
    console.log('\n\nForce shutdown requested...');
    process.exit(1);
    return;
  }

  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  isShuttingDown = true;

  // Allow main() to complete its finally block
  // The process will exit naturally after cleanup
});

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
