
import { LogMetadata } from "./types";

// Simple enhanced logger implementation
export const enhancedLogger = {
  info: (message: string, metadata?: LogMetadata) => {
    console.info(`[INFO] ${message}`, metadata || {});
  },
  warn: (message: string, metadata?: LogMetadata) => {
    console.warn(`[WARN] ${message}`, metadata || {});
  },
  error: (message: string, metadata?: LogMetadata) => {
    console.error(`[ERROR] ${message}`, metadata || {});
  },
  debug: (message: string, metadata?: LogMetadata) => {
    console.debug(`[DEBUG] ${message}`, metadata || {});
  }
};
