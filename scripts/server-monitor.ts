import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';

export interface ServerConfig {
  name: string;
  command: string;
  args: string[];
  port: number;
  env: Record<string, string>;
  healthPath?: string;
}

export interface LogEntry {
  timestamp: string;
  source: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
}

export class ServerMonitor {
  private process: ChildProcess | null = null;
  private config: ServerConfig;
  private logStream: fs.WriteStream | null = null;
  private isReady: boolean = false;

  constructor(config: ServerConfig, logStream?: fs.WriteStream) {
    this.config = config;
    this.logStream = logStream || null;
  }

  /**
   * Start the server process and attach log monitoring
   */
  async startServer(): Promise<void> {
    console.log(`[ServerMonitor] Starting ${this.config.name} on port ${this.config.port}...`);

    const env = {
      ...process.env,
      ...this.config.env,
      NODE_ENV: 'test',
      E2E_TESTING: 'true',
      RATE_LIMIT_BYPASS_E2E: 'true',
      DISABLE_AUTH_RATE_LIMIT: 'true'
    };

    this.process = spawn(this.config.command, this.config.args, {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    if (!this.process.stdout || !this.process.stderr) {
      throw new Error(`Failed to spawn ${this.config.name}: stdio not available`);
    }

    // Monitor stdout
    this.process.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.parseAndLogLine(line, 'stdout');
      });
    });

    // Monitor stderr
    this.process.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.parseAndLogLine(line, 'stderr');
      });
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      const exitMsg = `[ServerMonitor] ${this.config.name} exited with code ${code} and signal ${signal}`;
      console.log(exitMsg);
      this.writeLog({
        timestamp: new Date().toISOString(),
        source: this.config.name.toUpperCase().replace(/\s+/g, '-'),
        level: 'INFO',
        message: exitMsg
      });
      this.isReady = false;
    });

    // Handle process errors
    this.process.on('error', (error) => {
      const errorMsg = `[ServerMonitor] ${this.config.name} process error: ${error.message}`;
      console.error(errorMsg);
      this.writeLog({
        timestamp: new Date().toISOString(),
        source: this.config.name.toUpperCase().replace(/\s+/g, '-'),
        level: 'ERROR',
        message: errorMsg
      });
    });
  }

  /**
   * Parse log line and extract structured information
   */
  private parseAndLogLine(line: string, stdio: 'stdout' | 'stderr'): void {
    // Try to parse as JSON (structured logging)
    try {
      const json = JSON.parse(line);
      const logEntry: LogEntry = {
        timestamp: json.timestamp || new Date().toISOString(),
        source: this.config.name.toUpperCase().replace(/\s+/g, '-'),
        level: (json.level || 'INFO').toUpperCase() as LogEntry['level'],
        message: json.message || json.msg || line
      };

      // Only log ERROR and WARN to file
      if (logEntry.level === 'ERROR' || logEntry.level === 'WARN') {
        this.writeLog(logEntry);
      }

      // Also print to console for real-time monitoring
      if (logEntry.level === 'ERROR') {
        console.error(`[${this.config.name}] ${logEntry.message}`);
      } else if (logEntry.level === 'WARN') {
        console.warn(`[${this.config.name}] ${logEntry.message}`);
      }

      return;
    } catch (e) {
      // Not JSON, parse as text log
    }

    // Parse text format: TIMESTAMP LEVEL [CONTEXT] MESSAGE
    const textLogMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+(\w+)\s+\[([^\]]+)\]\s+(.+)$/);
    if (textLogMatch) {
      const [, timestamp, level, context, message] = textLogMatch;
      const logEntry: LogEntry = {
        timestamp,
        source: this.config.name.toUpperCase().replace(/\s+/g, '-'),
        level: level.toUpperCase() as LogEntry['level'],
        message: `[${context}] ${message}`
      };

      // Only log ERROR and WARN to file
      if (logEntry.level === 'ERROR' || logEntry.level === 'WARN') {
        this.writeLog(logEntry);
      }

      // Also print to console
      if (logEntry.level === 'ERROR') {
        console.error(`[${this.config.name}] ${logEntry.message}`);
      } else if (logEntry.level === 'WARN') {
        console.warn(`[${this.config.name}] ${logEntry.message}`);
      }

      return;
    }

    // Check for common error patterns
    const lowerLine = line.toLowerCase();
    let level: LogEntry['level'] = 'INFO';

    if (lowerLine.includes('error') || stdio === 'stderr') {
      level = 'ERROR';
    } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
      level = 'WARN';
    }

    // Only log errors and warnings
    if (level === 'ERROR' || level === 'WARN') {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        source: this.config.name.toUpperCase().replace(/\s+/g, '-'),
        level,
        message: line
      };

      this.writeLog(logEntry);

      if (level === 'ERROR') {
        console.error(`[${this.config.name}] ${line}`);
      } else {
        console.warn(`[${this.config.name}] ${line}`);
      }
    }
  }

  /**
   * Write log entry to file
   */
  private writeLog(entry: LogEntry): void {
    if (this.logStream && !this.logStream.destroyed) {
      const logLine = `[${entry.timestamp}] [${entry.source}] [${entry.level}] ${entry.message}\n`;
      this.logStream.write(logLine);
    }
  }

  /**
   * Wait for server to be ready by polling health endpoint
   */
  async waitForReady(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    const healthPath = this.config.healthPath || '/health';

    console.log(`[ServerMonitor] Waiting for ${this.config.name} to be ready on port ${this.config.port}...`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        await this.checkHealth(healthPath);
        this.isReady = true;
        console.log(`[ServerMonitor] ${this.config.name} is ready!`);
        return;
      } catch (error) {
        // Server not ready yet, wait and retry
        await this.sleep(1000);
      }
    }

    throw new Error(`${this.config.name} failed to become ready within ${timeoutMs}ms`);
  }

  /**
   * Check server health endpoint
   */
  private checkHealth(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: this.config.port,
        path,
        method: 'GET',
        timeout: 2000
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });

      req.end();
    });
  }

  /**
   * Stop the server process gracefully
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log(`[ServerMonitor] Stopping ${this.config.name}...`);

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log(`[ServerMonitor] Force killing ${this.config.name}...`);
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.process.kill('SIGTERM');
    });
  }

  /**
   * Get the underlying child process
   */
  getProcess(): ChildProcess | null {
    return this.process;
  }

  /**
   * Check if server is ready
   */
  isServerReady(): boolean {
    return this.isReady;
  }

  /**
   * Helper to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
