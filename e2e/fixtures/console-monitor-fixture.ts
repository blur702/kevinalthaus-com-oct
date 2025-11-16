import { test as base, TestInfo } from '@playwright/test';
import { ConsoleMonitor } from '../utils/console-monitor';
import * as fs from 'fs';
import * as path from 'path';

// Worker-scoped storage for shared log stream
let sharedLogStream: fs.WriteStream | null = null;

// Get or create shared log stream for the worker
function getLogStream(): fs.WriteStream | null {
  const monitoringEnabled = process.env.CONSOLE_MONITORING === 'true';
  if (!monitoringEnabled) {
    return null;
  }

  if (sharedLogStream && !sharedLogStream.destroyed) {
    return sharedLogStream;
  }

  // Get log path from environment or use default
  const logPath = process.env.CONSOLE_LOG_PATH || path.join(process.cwd(), 'test-results', 'console-errors.log');

  // Create test-results directory if it doesn't exist
  const testResultsDir = path.dirname(logPath);
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Open log stream in append mode to aggregate with server logs
  sharedLogStream = fs.createWriteStream(logPath, { flags: 'a' });

  return sharedLogStream;
}

// Extend Playwright test with console monitor fixture
// Using worker scope to share one monitor per worker process
export const test = base.extend<{ consoleMonitor: ConsoleMonitor }>({
  consoleMonitor: async ({ page }, use, testInfo: TestInfo) => {
    // Only attach console monitor if CONSOLE_MONITORING env var is set
    const monitoringEnabled = process.env.CONSOLE_MONITORING === 'true';

    if (!monitoringEnabled) {
      // No-op: just create an empty monitor without attaching
      const monitor = new ConsoleMonitor();
      await use(monitor);
      return;
    }

    // Get shared log stream
    const logStream = getLogStream();

    // Create and attach monitor
    const monitor = new ConsoleMonitor();
    monitor.attachToPage(page, logStream || undefined);

    // Write test start marker
    if (logStream && !logStream.destroyed) {
      logStream.write(`\n========================================\n`);
      logStream.write(`Test: ${testInfo.title}\n`);
      logStream.write(`File: ${testInfo.file}\n`);
      logStream.write(`Project: ${testInfo.project.name}\n`);
      logStream.write(`Started: ${new Date().toISOString()}\n`);
      logStream.write(`========================================\n\n`);
    }

    try {
      // Provide monitor to test
      await use(monitor);
    } finally {
      // Detach from page
      monitor.detachFromPage(page);

      // Write test end marker and summary
      if (logStream && !logStream.destroyed) {
        const summary = monitor.getSummary();
        logStream.write(`\n========================================\n`);
        logStream.write(`Test Complete: ${testInfo.title}\n`);
        logStream.write(`Status: ${testInfo.status}\n`);
        logStream.write(`Ended: ${new Date().toISOString()}\n`);
        logStream.write(`Browser Errors: ${summary.errors}\n`);
        logStream.write(`Browser Warnings: ${summary.warnings}\n`);

        if (summary.errors > 0) {
          logStream.write(`\nError Details:\n`);
          monitor.getErrorsByLevel('ERROR').forEach((err, idx) => {
            logStream.write(`  ${idx + 1}. [${err.type}] ${err.message}\n`);
            if (err.url) {
              logStream.write(`     URL: ${err.url}\n`);
            }
          });
        }

        logStream.write(`========================================\n\n`);
      }

      // Note: We don't close the shared stream here as it's reused across tests
      // It will be closed when the worker terminates
    }
  }
});

export { expect } from '@playwright/test';
