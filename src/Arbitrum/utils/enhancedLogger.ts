
import { LogMetadata } from "../shared/types";

// Log levels
type LogLevel = "debug" | "info" | "warn" | "error" | "success";

class EnhancedLogger {
  private logLevel: LogLevel = "info"; // Default log level
  
  // Set the minimum log level
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  // Convert log level to numeric value for comparison
  private getLevelValue(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      success: 1 // Success is same level as info
    };
    
    return levels[level] || 0;
  }
  
  // Check if a log should be displayed
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelValue(level) >= this.getLevelValue(this.logLevel);
  }
  
  // Format metadata for logging
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata) return '';
    
    try {
      return JSON.stringify(metadata, (key, value) => {
        // Handle BigNumber objects
        if (value && typeof value === 'object' && value.type === 'BigNumber') {
          return value.hex || value.toString();
        }
        // Handle circular references and complex objects
        if (key && value && typeof value === 'object' && !Array.isArray(value)) {
          if (key === 'data' || key === 'error' || key === 'metadata') {
            return `[Complex Object]`;
          }
        }
        return value;
      });
    } catch (e) {
      return '[Error formatting metadata]';
    }
  }
  
  // Main logging methods
  debug(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog('debug')) return;
    
    console.debug(`\x1b[90m[DEBUG] ${message}\x1b[0m`, this.formatMetadata(metadata));
  }
  
  info(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog('info')) return;
    
    console.info(`\x1b[36m[INFO] ${message}\x1b[0m`, this.formatMetadata(metadata));
  }
  
  warn(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog('warn')) return;
    
    console.warn(`\x1b[33m[WARN] ${message}\x1b[0m`, this.formatMetadata(metadata));
  }
  
  error(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog('error')) return;
    
    console.error(`\x1b[31m[ERROR] ${message}\x1b[0m`, this.formatMetadata(metadata));
  }
  
  success(message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog('info')) return;
    
    console.info(`\x1b[32m[SUCCESS] ${message}\x1b[0m`, this.formatMetadata(metadata));
  }
  
  // Combined method for compatibility
  logEvent(level: string, message: string, metadata?: LogMetadata): void {
    switch (level) {
      case 'debug':
        this.debug(message, metadata);
        break;
      case 'info':
        this.info(message, metadata);
        break;
      case 'warn':
        this.warn(message, metadata);
        break;
      case 'error':
        this.error(message, metadata);
        break;
      case 'success':
        this.success(message, metadata);
        break;
      default:
        this.info(message, metadata);
    }
  }
}

// Export singleton instance
export const enhancedLogger = new EnhancedLogger();
