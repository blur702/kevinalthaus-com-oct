import { Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';

export interface BrowserError {
  timestamp: string;
  type: 'console' | 'pageerror' | 'requestfailed';
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  url?: string;
  stack?: string;
}

export class ConsoleMonitor {
  private errors: BrowserError[] = [];
  private logStream: fs.WriteStream | null = null;
  private consoleListener: ((msg: ConsoleMessage) => void) | null = null;
  private pageErrorListener: ((error: Error) => void) | null = null;
  private requestFailedListener: ((request: any) => void) | null = null;

  /**
   * Attach console monitoring to a Playwright page
   */
  attachToPage(page: Page, logStream?: fs.WriteStream): void {
    this.logStream = logStream || null;

    // Listen for console messages
    this.consoleListener = (msg: ConsoleMessage) => {
      const type = msg.type();

      // Filter out noise
      const text = msg.text();
      if (this.shouldIgnoreMessage(text)) {
        return;
      }

      let level: BrowserError['level'] = 'INFO';
      if (type === 'error') {
        level = 'ERROR';
      } else if (type === 'warning') {
        level = 'WARN';
      } else if (type === 'log' || type === 'info' || type === 'debug') {
        // Only capture console.error and console.warn, not regular logs
        return;
      }

      const error: BrowserError = {
        timestamp: new Date().toISOString(),
        type: 'console',
        level,
        message: text,
        url: msg.location().url
      };

      this.errors.push(error);
      this.writeLog(error);

      // Also print to console for real-time monitoring
      if (level === 'ERROR') {
        console.error(`[BROWSER] ${text}`);
      } else if (level === 'WARN') {
        console.warn(`[BROWSER] ${text}`);
      }
    };

    page.on('console', this.consoleListener);

    // Listen for uncaught JavaScript exceptions
    this.pageErrorListener = (error: Error) => {
      const browserError: BrowserError = {
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        level: 'ERROR',
        message: error.message,
        stack: error.stack
      };

      this.errors.push(browserError);
      this.writeLog(browserError);
      console.error(`[BROWSER] Uncaught exception: ${error.message}`);
    };

    page.on('pageerror', this.pageErrorListener);

    // Listen for failed network requests
    this.requestFailedListener = (request: any) => {
      const failure = request.failure();
      if (!failure) {
        return;
      }

      const browserError: BrowserError = {
        timestamp: new Date().toISOString(),
        type: 'requestfailed',
        level: 'ERROR',
        message: `Failed to load: ${request.url()} - ${failure.errorText}`,
        url: request.url()
      };

      this.errors.push(browserError);
      this.writeLog(browserError);
      console.error(`[BROWSER] Network failure: ${request.url()}`);
    };

    page.on('requestfailed', this.requestFailedListener);
  }

  /**
   * Detach console monitoring from a page
   */
  detachFromPage(page: Page): void {
    if (this.consoleListener) {
      page.off('console', this.consoleListener);
      this.consoleListener = null;
    }

    if (this.pageErrorListener) {
      page.off('pageerror', this.pageErrorListener);
      this.pageErrorListener = null;
    }

    if (this.requestFailedListener) {
      page.off('requestfailed', this.requestFailedListener);
      this.requestFailedListener = null;
    }
  }

  /**
   * Filter out noise from browser console
   */
  private shouldIgnoreMessage(message: string): boolean {
    const ignorePatterns = [
      /Download the React DevTools/i,
      /React DevTools/i,
      /\[HMR\]/i,
      /\[vite\]/i,
      /Hot Module Replacement/i,
      /Lit is in dev mode/i,
      /webpack/i,
      /sockjs-node/i,
      /%c/,  // Styled console logs
      /^\s*$/,  // Empty messages
      /admin-theme-overrides\.css/i,  // Optional CSS file with onerror handler
      /theme-overrides\.css/i  // Optional theme override files
    ];

    return ignorePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Write log entry to file
   */
  private writeLog(error: BrowserError): void {
    if (this.logStream && !this.logStream.destroyed) {
      let logLine = `[${error.timestamp}] [BROWSER] [${error.level}] ${error.message}`;

      if (error.url) {
        logLine += ` (${error.url})`;
      }

      if (error.stack) {
        logLine += `\n${error.stack}`;
      }

      logLine += '\n';

      this.logStream.write(logLine);
    }
  }

  /**
   * Get all collected errors
   */
  getErrors(): BrowserError[] {
    return [...this.errors];
  }

  /**
   * Get errors by level
   */
  getErrorsByLevel(level: 'ERROR' | 'WARN'): BrowserError[] {
    return this.errors.filter(error => error.level === level);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: BrowserError['type']): BrowserError[] {
    return this.errors.filter(error => error.type === type);
  }

  /**
   * Check if any errors were captured
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if any critical errors (not warnings) were captured
   */
  hasCriticalErrors(): boolean {
    return this.errors.some(error => error.level === 'ERROR');
  }

  /**
   * Clear all collected errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Get summary of errors
   */
  getSummary(): { total: number; errors: number; warnings: number; byType: Record<string, number> } {
    const summary = {
      total: this.errors.length,
      errors: 0,
      warnings: 0,
      byType: {
        console: 0,
        pageerror: 0,
        requestfailed: 0
      }
    };

    this.errors.forEach(error => {
      if (error.level === 'ERROR') {
        summary.errors++;
      } else if (error.level === 'WARN') {
        summary.warnings++;
      }

      summary.byType[error.type]++;
    });

    return summary;
  }

  /**
   * Manually log an error (for use in test code)
   */
  logError(message: string, level: 'ERROR' | 'WARN' = 'ERROR'): void {
    const error: BrowserError = {
      timestamp: new Date().toISOString(),
      type: 'console',
      level,
      message
    };

    this.errors.push(error);
    this.writeLog(error);

    if (level === 'ERROR') {
      console.error(`[BROWSER] ${message}`);
    } else {
      console.warn(`[BROWSER] ${message}`);
    }
  }

  /**
   * Close the log stream
   */
  close(): void {
    if (this.logStream && !this.logStream.destroyed) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

/**
 * Create a Playwright test fixture for console monitoring
 */
export function createConsoleMonitorFixture(logStream?: fs.WriteStream) {
  return {
    monitor: new ConsoleMonitor(),

    async autoAttach({ page }: { page: Page }, use: any) {
      const monitor = new ConsoleMonitor();
      monitor.attachToPage(page, logStream);

      await use(monitor);

      monitor.detachFromPage(page);
    }
  };
}
