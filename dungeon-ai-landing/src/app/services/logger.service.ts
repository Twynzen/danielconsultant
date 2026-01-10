import { Injectable, isDevMode } from '@angular/core';

/**
 * Logger Service
 *
 * Provides logging functionality that only outputs in development mode.
 * Use this instead of console.log to prevent information leakage in production.
 *
 * Usage:
 *   constructor(private logger: LoggerService) {}
 *   this.logger.log('[Component] Message', data);
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isDev = isDevMode();

  /**
   * Log informational messages (only in development)
   */
  log(message: string, ...args: any[]): void {
    if (this.isDev) {
      console.log(message, ...args);
    }
  }

  /**
   * Log warning messages (only in development)
   */
  warn(message: string, ...args: any[]): void {
    if (this.isDev) {
      console.warn(message, ...args);
    }
  }

  /**
   * Log error messages (always logged, even in production)
   */
  error(message: string, ...args: any[]): void {
    console.error(message, ...args);
  }

  /**
   * Log debug messages with additional context (only in development)
   */
  debug(context: string, message: string, data?: any): void {
    if (this.isDev) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      if (data !== undefined) {
        console.log(`[${timestamp}] [${context}] ${message}`, data);
      } else {
        console.log(`[${timestamp}] [${context}] ${message}`);
      }
    }
  }

  /**
   * Log performance timing (only in development)
   */
  time(label: string): void {
    if (this.isDev) {
      console.time(label);
    }
  }

  /**
   * End performance timing (only in development)
   */
  timeEnd(label: string): void {
    if (this.isDev) {
      console.timeEnd(label);
    }
  }

  /**
   * Group related logs (only in development)
   */
  group(label: string): void {
    if (this.isDev) {
      console.group(label);
    }
  }

  /**
   * End log group (only in development)
   */
  groupEnd(): void {
    if (this.isDev) {
      console.groupEnd();
    }
  }
}
