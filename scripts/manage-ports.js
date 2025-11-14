#!/usr/bin/env node

/**
 * Port Management Script
 *
 * This script manages service ports to ensure clean startup without conflicts.
 * It can check for processes using specific ports and kill them if needed.
 *
 * Usage:
 *   node scripts/manage-ports.js check <port>           - Check if port is in use
 *   node scripts/manage-ports.js kill <port>            - Kill process on port
 *   node scripts/manage-ports.js clean                  - Kill all service ports
 *   node scripts/manage-ports.js start <service>        - Kill port and start service
 *
 * Examples:
 *   node scripts/manage-ports.js check 3000
 *   node scripts/manage-ports.js kill 3000
 *   node scripts/manage-ports.js clean
 *   node scripts/manage-ports.js start api-gateway
 */

const { execSync, exec } = require('child_process');
const path = require('path');

/**
 * Port Configuration Loading
 *
 * This script requires the shared package to be built to load port configurations.
 * If the build doesn't exist, it falls back to hardcoded default ports.
 *
 * Build requirement:
 *   cd packages/shared && npm run build
 *
 * The fallback exists to allow the script to work during initial setup or
 * in CI environments before the build step has run, but using the fallback
 * may result in incorrect port assignments if ports have been customized.
 */
const portsConfigPath = path.resolve(__dirname, '../packages/shared/dist/config/ports');

let PORTS;
try {
  PORTS = require(portsConfigPath).PORTS;
} catch (error) {
  console.warn('Warning: Could not load ports from shared package. Using defaults.');
  console.warn('Run "cd packages/shared && npm run build" to use configured ports.');
  PORTS = {
    API_GATEWAY: 3000,
    FRONTEND: 3001,
    ADMIN: 3002,
    MAIN_APP: 3003,
    PLUGIN_ENGINE: 3004,
    PYTHON_SERVICE: 8000,
  };
}

// Validate PORTS configuration
if (!PORTS || typeof PORTS !== 'object') {
  console.error('Error: PORTS configuration is invalid. Expected an object.');
  process.exit(1);
}

// Validate each port value
for (const [serviceName, port] of Object.entries(PORTS)) {
  if (typeof port !== 'number' || !Number.isFinite(port) || !Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`Error: Invalid port for ${serviceName}: ${port}`);
    console.error(`Port must be a number between 1 and 65535.`);
    process.exit(1);
  }
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Validate and sanitize port input
 * @param {number} port - Port number to validate
 * @returns {number} - Valid port number
 * @throws {Error} - If port is invalid
 */
function ensureValidPort(port) {
  if (
    typeof port !== 'number' ||
    !Number.isFinite(port) ||
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(`Invalid port: ${port}. Port must be a number between 1 and 65535.`);
  }
  return port;
}

/**
 * Check if a port is in use
 * @param {number} port - Port number to check
 * @returns {Promise<{inUse: boolean, pid?: number, command?: string}>}
 */
async function checkPort(port) {
  // Sanitize port input
  const validPort = ensureValidPort(port);

  return new Promise((resolve) => {
    const platform = process.platform;

    let command;
    if (platform === 'win32') {
      // Only match LISTENING entries on Windows to avoid foreign connections
      command = `netstat -ano | findstr :${validPort} | findstr LISTENING`;
    } else {
      // Use lsof with -nP flags and filter for LISTEN state
      command = `lsof -nP -iTCP:${validPort} -sTCP:LISTEN -t`;
    }

    exec(command, { timeout: 5000 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve({ inUse: false });
        return;
      }

      if (platform === 'win32') {
        // Parse Windows netstat output
        const lines = stdout.trim().split('\n');
        const line = lines[0];
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);

        // Validate PID
        if (!Number.isFinite(pid) || Number.isNaN(pid)) {
          console.warn(`[manage-ports] Failed to parse PID from netstat output: ${stdout.substring(0, 100)}`);
          resolve({ inUse: false });
          return;
        }

        // Get process name
        try {
          const tasklistCmd = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
          const taskOutput = execSync(tasklistCmd, { encoding: 'utf8', timeout: 5000 });
          const processName = taskOutput.split(',')[0].replace(/"/g, '');
          resolve({ inUse: true, pid, command: processName });
        } catch {
          resolve({ inUse: true, pid });
        }
      } else {
        // Unix-based systems (lsof output)
        const rawPid = stdout.trim().split('\n')[0];
        const pid = parseInt(rawPid, 10);

        // Validate PID
        if (!Number.isFinite(pid) || Number.isNaN(pid)) {
          // Try regex extraction as fallback
          const match = rawPid.match(/\d+/);
          if (match) {
            const retryPid = parseInt(match[0], 10);
            if (Number.isFinite(retryPid) && !Number.isNaN(retryPid)) {
              // Use extracted PID
              try {
                const psCmd = `ps -p ${retryPid} -o comm=`;
                const psOutput = execSync(psCmd, { encoding: 'utf8', timeout: 5000 }).trim();
                resolve({ inUse: true, pid: retryPid, command: psOutput });
                return;
              } catch {
                resolve({ inUse: true, pid: retryPid });
                return;
              }
            }
          }
          console.warn(`[manage-ports] Failed to parse PID from lsof output: ${stdout.substring(0, 100)}`);
          resolve({ inUse: false });
          return;
        }

        try {
          const psCmd = `ps -p ${pid} -o comm=`;
          const psOutput = execSync(psCmd, { encoding: 'utf8', timeout: 5000 }).trim();
          resolve({ inUse: true, pid, command: psOutput });
        } catch {
          resolve({ inUse: true, pid });
        }
      }
    });
  });
}

/**
 * Kill process on a port
 * @param {number} port - Port number
 * @returns {Promise<boolean>} - True if killed, false if nothing to kill
 */
async function killPort(port) {
  const status = await checkPort(port);

  if (!status.inUse) {
    return false;
  }

  log(`Killing process on port ${port} (PID: ${status.pid})...`, 'yellow');

  try {
    const platform = process.platform;
    if (platform === 'win32') {
      execSync(`taskkill /F /PID ${status.pid}`, { stdio: 'ignore', timeout: 5000 });
    } else {
      execSync(`kill -9 ${status.pid}`, { stdio: 'ignore', timeout: 5000 });
    }

    // Wait a moment for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));

    log(`✓ Successfully killed process on port ${port}`, 'green');
    return true;
  } catch (error) {
    log(`✗ Failed to kill process on port ${port}: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Clean all service ports
 */
async function cleanAllPorts() {
  log('Cleaning all service ports...', 'cyan');

  const ports = Object.values(PORTS);
  const results = [];

  for (const port of ports) {
    const serviceName = Object.keys(PORTS).find(key => PORTS[key] === port);
    log(`\nChecking ${serviceName} (port ${port})...`, 'blue');

    const status = await checkPort(port);
    if (status.inUse) {
      log(`  Port ${port} is in use by PID ${status.pid}${status.command ? ` (${status.command})` : ''}`, 'yellow');
      const killed = await killPort(port);
      results.push({ port, serviceName, killed });
    } else {
      log(`  Port ${port} is available`, 'green');
      results.push({ port, serviceName, killed: false, available: true });
    }
  }

  log('\n' + '='.repeat(50), 'cyan');
  log('Port Cleanup Summary:', 'cyan');
  log('='.repeat(50), 'cyan');

  for (const result of results) {
    if (result.available) {
      log(`✓ ${result.serviceName.padEnd(20)} (${result.port}) - Available`, 'green');
    } else if (result.killed) {
      log(`✓ ${result.serviceName.padEnd(20)} (${result.port}) - Cleaned`, 'green');
    } else {
      log(`✗ ${result.serviceName.padEnd(20)} (${result.port}) - Failed to clean`, 'red');
    }
  }
}

/**
 * Start a service by killing its port first
 * @param {string} serviceName - Service name (e.g., 'api-gateway', 'main-app')
 */
async function startService(serviceName) {
  // Map service name to port config key
  const serviceMap = {
    'api-gateway': 'API_GATEWAY',
    'frontend': 'FRONTEND',
    'admin': 'ADMIN',
    'main-app': 'MAIN_APP',
    'plugin-engine': 'PLUGIN_ENGINE',
    'python-service': 'PYTHON_SERVICE',
  };

  const configKey = serviceMap[serviceName];
  if (!configKey) {
    log(`Unknown service: ${serviceName}`, 'red');
    log(`Available services: ${Object.keys(serviceMap).join(', ')}`, 'yellow');
    process.exit(1);
  }

  const port = PORTS[configKey];

  // Validate port before using it
  try {
    ensureValidPort(port);
  } catch (error) {
    log(`Error: Invalid port configuration for ${serviceName}`, 'red');
    log(`Port value: ${port} (${typeof port})`, 'yellow');
    log(`Config key: ${configKey}`, 'yellow');
    log(`Available port keys: ${Object.keys(PORTS).join(', ')}`, 'blue');
    log(`Validation error: ${error.message}`, 'yellow');
    process.exit(1);
  }

  log(`Starting ${serviceName} on port ${port}...`, 'cyan');

  // Kill any existing process on the port
  await killPort(port);

  log(`Port ${port} is now available for ${serviceName}`, 'green');
  log(`You can now start the service with: npm run dev (in the service directory)`, 'blue');
}

/**
 * Display port status
 */
async function displayStatus() {
  log('Service Port Status:', 'cyan');
  log('='.repeat(60), 'cyan');

  const ports = Object.entries(PORTS);

  for (const [serviceName, port] of ports) {
    const status = await checkPort(port);
    const name = serviceName.padEnd(20);
    const portStr = String(port).padEnd(6);

    if (status.inUse) {
      const processInfo = status.command ? ` (${status.command})` : '';
      log(`${name} ${portStr} - IN USE by PID ${status.pid}${processInfo}`, 'yellow');
    } else {
      log(`${name} ${portStr} - Available`, 'green');
    }
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const arg = args[1];

  if (!command) {
    log('Port Management Script', 'cyan');
    log('='.repeat(50), 'cyan');
    log('Usage:', 'blue');
    log('  node scripts/manage-ports.js status              - Show port status');
    log('  node scripts/manage-ports.js check <port>        - Check if port is in use');
    log('  node scripts/manage-ports.js kill <port>         - Kill process on port');
    log('  node scripts/manage-ports.js clean               - Kill all service ports');
    log('  node scripts/manage-ports.js start <service>     - Prepare port for service');
    log('\nExamples:', 'blue');
    log('  node scripts/manage-ports.js status');
    log('  node scripts/manage-ports.js check 3000');
    log('  node scripts/manage-ports.js kill 3000');
    log('  node scripts/manage-ports.js clean');
    log('  node scripts/manage-ports.js start api-gateway');
    process.exit(0);
  }

  switch (command) {
    case 'status':
      await displayStatus();
      break;

    case 'check': {
      if (!arg) {
        log('Error: Port number required', 'red');
        log('Usage: node scripts/manage-ports.js check <port>', 'yellow');
        process.exit(1);
      }
      const port = parseInt(arg, 10);
      try {
        ensureValidPort(port);
        const status = await checkPort(port);
        if (status.inUse) {
          log(`Port ${port} is IN USE by PID ${status.pid}${status.command ? ` (${status.command})` : ''}`, 'red');
        } else {
          log(`Port ${port} is available`, 'green');
        }
      } catch (error) {
        log(error.message, 'red');
        process.exit(1);
      }
      break;
    }

    case 'kill': {
      if (!arg) {
        log('Error: Port number required', 'red');
        log('Usage: node scripts/manage-ports.js kill <port>', 'yellow');
        process.exit(1);
      }
      const port = parseInt(arg, 10);
      try {
        ensureValidPort(port);
        const killed = await killPort(port);
        if (!killed) {
          log(`No process found on port ${port}`, 'yellow');
        }
      } catch (error) {
        log(error.message, 'red');
        process.exit(1);
      }
      break;
    }

    case 'clean':
      await cleanAllPorts();
      break;

    case 'start': {
      if (!arg) {
        log('Error: Service name required', 'red');
        log('Usage: node scripts/manage-ports.js start <service>', 'yellow');
        log('Available services: api-gateway, frontend, admin, main-app, plugin-engine, python-service', 'blue');
        process.exit(1);
      }
      await startService(arg);
      break;
    }

    default:
      log(`Unknown command: ${command}`, 'red');
      log('Run without arguments to see usage', 'yellow');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { checkPort, killPort, cleanAllPorts, startService };
