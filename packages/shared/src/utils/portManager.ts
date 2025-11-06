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
      const lines = stdout.trim().split('\n');
      const match = lines[0].match(/\s+(\d+)\s*$/);
      const pid = match ? parseInt(match[1], 10) : undefined;
      return { inUse: true, pid };
    } else {
      // Unix: lsof -ti returns PID directly
      const pid = parseInt(stdout.trim().split('\n')[0], 10);
      return { inUse: true, pid };
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

    if (!portCheck.inUse || !portCheck.pid) {
      return false; // Port not in use
    }

    const killCommand = process.platform === 'win32'
      ? `taskkill /F /PID ${portCheck.pid}`
      : `kill -9 ${portCheck.pid}`;

    await execAsync(killCommand);

    // Wait a bit for process to die
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify port is now free
    const recheck = await isPortInUse(port);
    return !recheck.inUse;
  } catch (error) {
    console.error(`Failed to kill process on port ${port}:`, error);
    return false;
  }
}

/**
 * Ensure a port is available, optionally killing existing processes
 */
export async function ensurePortAvailable(options: PortManagerOptions): Promise<void> {
  const { port, serviceName, killExisting = true } = options;

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
