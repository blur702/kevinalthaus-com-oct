#!/usr/bin/env node

/**
 * Port Cleanup Script
 *
 * Kills all processes using the application's ports to ensure
 * consistent port assignment across runs.
 *
 * Works on both Windows and Unix-like systems.
 */

const { execSync } = require('child_process');
const os = require('os');

// Define all ports used by the application
const PORTS = {
  'API Gateway': 3000,
  'Main App': 3001,
  'Frontend': 3002,
  'Admin': 3003,
  'Plugin Engine': 3004,
  'Python Service': 8000,
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Find process ID using a port on Windows
 */
function findProcessOnPortWindows(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = output.split('\n').filter(line => line.trim());

    const pids = new Set();
    for (const line of lines) {
      // Match lines like: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
      const match = line.match(/\s+(\d+)\s*$/);
      if (match) {
        const pid = match[1];
        // Skip system process (PID 0 or 4)
        if (pid !== '0' && pid !== '4') {
          pids.add(pid);
        }
      }
    }

    return Array.from(pids);
  } catch (error) {
    // No process found on this port
    return [];
  }
}

/**
 * Find process ID using a port on Unix
 */
function findProcessOnPortUnix(port) {
  try {
    // Try lsof first (most reliable)
    const output = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8' });
    const pids = output.split('\n').filter(pid => pid.trim()).map(pid => pid.trim());
    return pids;
  } catch (error) {
    try {
      // Fallback to netstat + ps
      const netstatOutput = execSync(`netstat -tlnp 2>/dev/null | grep :${port} || true`, { encoding: 'utf8' });
      const match = netstatOutput.match(/(\d+)\//);
      return match ? [match[1]] : [];
    } catch (e) {
      return [];
    }
  }
}

/**
 * Kill a process by PID on Windows
 */
function killProcessWindows(pid) {
  try {
    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Kill a process by PID on Unix
 */
function killProcessUnix(pid) {
  try {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get process info by PID on Windows
 */
function getProcessInfoWindows(pid) {
  try {
    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
    const match = output.match(/"([^"]+)"/);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Get process info by PID on Unix
 */
function getProcessInfoUnix(pid) {
  try {
    const output = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Clean up ports based on platform
 */
async function cleanupPorts() {
  const platform = os.platform();
  const isWindows = platform === 'win32';

  log(`\n${'='.repeat(60)}`, 'bright');
  log('Port Cleanup Utility', 'bright');
  log(`${'='.repeat(60)}\n`, 'bright');

  logInfo(`Platform: ${platform}`);
  logInfo(`Cleaning up ports for application services...\n`);

  let totalKilled = 0;
  let totalChecked = 0;

  for (const [serviceName, port] of Object.entries(PORTS)) {
    totalChecked++;
    log(`\nChecking ${serviceName} (port ${port})...`, 'blue');

    // Find processes on this port
    const pids = isWindows
      ? findProcessOnPortWindows(port)
      : findProcessOnPortUnix(port);

    if (pids.length === 0) {
      logSuccess(`Port ${port} is free`);
      continue;
    }

    logWarning(`Found ${pids.length} process(es) using port ${port}`);

    // Kill each process
    for (const pid of pids) {
      const processInfo = isWindows
        ? getProcessInfoWindows(pid)
        : getProcessInfoUnix(pid);

      log(`  Killing PID ${pid} (${processInfo})...`, 'yellow');

      const killed = isWindows
        ? killProcessWindows(pid)
        : killProcessUnix(pid);

      if (killed) {
        logSuccess(`  Successfully killed PID ${pid}`);
        totalKilled++;
      } else {
        logError(`  Failed to kill PID ${pid}`);
      }
    }
  }

  // Summary
  log(`\n${'='.repeat(60)}`, 'bright');
  log('Summary', 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  logInfo(`Ports checked: ${totalChecked}`);
  logInfo(`Processes killed: ${totalKilled}`);

  if (totalKilled > 0) {
    logSuccess('\nPorts cleaned up successfully!');
  } else {
    logSuccess('\nAll ports were already free!');
  }

  log('');
}

// Run the cleanup
cleanupPorts().catch(error => {
  logError(`\nError during port cleanup: ${error.message}`);
  process.exit(1);
});
