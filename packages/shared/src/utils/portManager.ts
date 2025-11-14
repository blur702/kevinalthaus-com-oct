/**
 * Port Management Utility
 *
 * Handles port conflict resolution by checking if a port is in use
 * and optionally killing the process using it before starting a new service.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PortCheckResult {
  inUse: boolean;
  pid?: number;
  processName?: string;
}

export interface PortManagerOptions {
  port: number;
  serviceName: string;
  killExisting?: boolean;
  timeout?: number;
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<PortCheckResult> {
  try {
    // Cross-platform port check using netstat or lsof
    const command = process.platform === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -ti:${port}`;

    const { stdout } = await execAsync(command);

    if (!stdout || stdout.trim() === '') {
      return { inUse: false };
    }

    // Parse PID from output
    if (process.platform === 'win32') {
      // Windows: Extract PID from netstat output
      // Format: TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       12345
      // or:     TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       12345
      const lines = stdout.trim().split('\n');

      let foundListeningLine = false;
      for (const line of lines) {
        // Look for lines in LISTENING state
        if (!line.includes('LISTENING')) {
          continue;
        }
        foundListeningLine = true;

        // Extract PID from the end of the line
        const match = line.match(/\s+(\d+)\s*$/);
        if (match) {
          const pid = parseInt(match[1], 10);
          // Skip system process (PID 0 or 4) and invalid PIDs
          if (pid > 4 && !isNaN(pid)) {
            return { inUse: true, pid };
          }
        }
      }

      if (!foundListeningLine) {
        // Only TIME_WAIT/CLOSE_WAIT entries were present; treat as available
        return { inUse: false };
      }

      // If we found LISTENING output but no valid PID, port might be in use by system
      return { inUse: true, pid: undefined };
    } else {
      // Unix: lsof -ti returns PID directly
      const pidStr = stdout.trim().split('\n')[0];
      const pid = parseInt(pidStr, 10);
      return { inUse: true, pid: !isNaN(pid) ? pid : undefined };
    }
  } catch (error) {
    // Command failed means port is not in use
    return { inUse: false };
  }
}

/**
 * Kill process using a specific port
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    const portCheck = await isPortInUse(port);

    if (!portCheck.inUse) {
      console.log(`Port ${port} is not in use`);
      return false;
    }

    if (!portCheck.pid) {
      console.error(`Port ${port} is in use but PID could not be determined (system process or insufficient permissions)`);
      return false;
    }

    console.log(`Killing process ${portCheck.pid} on port ${port}...`);

    const killCommand = process.platform === 'win32'
      ? `taskkill /F /PID ${portCheck.pid}`
      : `kill -9 ${portCheck.pid}`;

    await execAsync(killCommand);

    // Wait a bit for process to die
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify port is now free
    const recheck = await isPortInUse(port);
    if (!recheck.inUse) {
      console.log(`Successfully killed process ${portCheck.pid} and freed port ${port}`);
      return true;
    } else {
      console.warn(`Port ${port} still in use after killing process ${portCheck.pid}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to kill process on port ${port}:`, error);
    return false;
  }
}

/**
 * Ensure a port is available, optionally killing existing processes
 * Skips port checking in Docker/containerized environments where PID 1 cannot be killed
 */
export async function ensurePortAvailable(options: PortManagerOptions): Promise<void> {
  const { port, serviceName, killExisting = true } = options;

  // Skip port management in containerized environments only
  // In Docker, the process IS pid 1 and checking/killing it would fail
  const isDocker = process.pid === 1;

  if (isDocker) {
    console.log(`[${serviceName}] Running in containerized environment, skipping port check`);
    return;
  }

  console.log(`[${serviceName}] Checking port ${port}...`);

  const portCheck = await isPortInUse(port);

  if (!portCheck.inUse) {
    console.log(`[${serviceName}] Port ${port} is available`);
    return;
  }

  console.warn(`[${serviceName}] Port ${port} is in use (PID: ${portCheck.pid})`);

  if (!killExisting) {
    throw new Error(
      `Port ${port} is already in use. Set killExisting=true to automatically kill the process.`
    );
  }

  console.log(`[${serviceName}] Killing process ${portCheck.pid} on port ${port}...`);

  const killed = await killProcessOnPort(port);

  if (!killed) {
    throw new Error(
      `Failed to kill process on port ${port}. Please manually stop it and try again.`
    );
  }

  console.log(`[${serviceName}] Port ${port} is now available`);
}

/**
 * Wait for a port to become available (useful after killing a process)
 */
export async function waitForPortFree(port: number, timeout: number = 5000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const portCheck = await isPortInUse(port);
    if (!portCheck.inUse) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Get process info for a port (for logging/debugging)
 */
export async function getPortInfo(port: number): Promise<string> {
  const portCheck = await isPortInUse(port);

  if (!portCheck.inUse) {
    return `Port ${port}: Available`;
  }

  return `Port ${port}: In use (PID: ${portCheck.pid || 'unknown'})`;
}
