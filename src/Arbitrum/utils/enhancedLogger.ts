
import { LogMetadata } from "./types";

// Function to get current timestamp in a standardized format
const getTimestamp = () => {
  return new Date().toISOString();
};

// Track execution times for performance monitoring
const executionTimers: Record<string, number> = {};

// Enhanced logger implementation with additional features
export const enhancedLogger = {
  info: (message: string, metadata?: LogMetadata) => {
    const logObj = { timestamp: getTimestamp(), level: "INFO", message, ...metadata };
    console.info(`[INFO] ${message}`, metadata || {});
    return logObj;
  },
  warn: (message: string, metadata?: LogMetadata) => {
    const logObj = { timestamp: getTimestamp(), level: "WARN", message, ...metadata };
    console.warn(`[WARN] ${message}`, metadata || {});
    return logObj;
  },
  error: (message: string, metadata?: LogMetadata) => {
    const logObj = { timestamp: getTimestamp(), level: "ERROR", message, ...metadata };
    console.error(`[ERROR] ${message}`, metadata || {});
    return logObj;
  },
  debug: (message: string, metadata?: LogMetadata) => {
    // Only log in development or when debug mode is enabled
    const logObj = { timestamp: getTimestamp(), level: "DEBUG", message, ...metadata };
    if (process.env.NODE_ENV === "development" || process.env.DEBUG_MODE === "true") {
      console.debug(`[DEBUG] ${message}`, metadata || {});
    }
    return logObj;
  },
  critical: (message: string, metadata?: LogMetadata) => {
    const logObj = { timestamp: getTimestamp(), level: "CRITICAL", message, ...metadata };
    console.error(`[CRITICAL] ${message}`, metadata || {});
    // Could integrate with notification systems here
    return logObj;
  },
  startTimer: (label: string) => {
    executionTimers[label] = performance.now();
    return executionTimers[label];
  },
  endTimer: (label: string, metadata?: LogMetadata) => {
    if (!executionTimers[label]) {
      console.warn(`No timer started for "${label}"`);
      return;
    }
    const duration = performance.now() - executionTimers[label];
    const logObj = {
      timestamp: getTimestamp(),
      level: "PERF",
      message: `${label} took ${duration.toFixed(2)}ms`,
      duration,
      ...metadata
    };
    console.info(`[PERF] ${label} took ${duration.toFixed(2)}ms`, metadata || {});
    delete executionTimers[label];
    return logObj;
  },
  // Method to log bot state changes
  botState: (botType: string, state: string, metadata?: LogMetadata) => {
    const logObj = {
      timestamp: getTimestamp(),
      level: "STATE",
      message: `Bot ${botType} state changed to ${state}`,
      botType,
      state,
      ...metadata
    };
    console.info(`[STATE] Bot ${botType} state changed to ${state}`, metadata || {});
    return logObj;
  },
  // Method to log transaction details
  transaction: (botType: string, transactionType: string, status: string, metadata?: LogMetadata) => {
    const logObj = {
      timestamp: getTimestamp(),
      level: "TX",
      message: `[${botType}] Transaction ${transactionType}: ${status}`,
      botType,
      transactionType,
      status,
      ...metadata
    };
    console.info(`[TX] [${botType}] ${transactionType}: ${status}`, metadata || {});
    return logObj;
  }
};

// Export additional utility functions
export const wrapWithErrorLogging = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
  metadata?: LogMetadata
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    const errorObj = error as Error;
    enhancedLogger.error(`${errorMessage}: ${errorObj.message}`, {
      ...(metadata || {}),
      stack: errorObj.stack,
      errorName: errorObj.name
    });
    return null;
  }
};

// Middleware function for wrapping critical sections
export const monitorExecution = async <T>(
  label: string,
  fn: () => Promise<T>,
  metadata?: LogMetadata
): Promise<T> => {
  enhancedLogger.startTimer(label);
  try {
    const result = await fn();
    enhancedLogger.endTimer(label, metadata);
    return result;
  } catch (error) {
    const errorObj = error as Error;
    enhancedLogger.error(`Error in ${label}: ${errorObj.message}`, {
      ...(metadata || {}),
      duration: performance.now() - executionTimers[label],
      stack: errorObj.stack
    });
    delete executionTimers[label];
    throw error;
  }
};

// Function to create a contextual logger with predefined metadata
export const createContextLogger = (context: LogMetadata) => {
  return {
    info: (message: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.info(message, { ...context, ...additionalMetadata }),
    warn: (message: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.warn(message, { ...context, ...additionalMetadata }),
    error: (message: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.error(message, { ...context, ...additionalMetadata }),
    debug: (message: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.debug(message, { ...context, ...additionalMetadata }),
    critical: (message: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.critical(message, { ...context, ...additionalMetadata }),
    transaction: (transactionType: string, status: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.transaction(context.botType as string, transactionType, status, { ...context, ...additionalMetadata }),
    botState: (state: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.botState(context.botType as string, state, { ...context, ...additionalMetadata }),
    startTimer: enhancedLogger.startTimer,
    endTimer: (label: string, additionalMetadata?: LogMetadata) => 
      enhancedLogger.endTimer(label, { ...context, ...additionalMetadata }),
    wrapWithErrorLogging: async <T>(fn: () => Promise<T>, errorMessage: string, additionalMetadata?: LogMetadata): Promise<T | null> => {
      return wrapWithErrorLogging(fn, errorMessage, { ...context, ...additionalMetadata });
    },
    monitorExecution: async <T>(label: string, fn: () => Promise<T>, additionalMetadata?: LogMetadata): Promise<T> => {
      return monitorExecution(label, fn, { ...context, ...additionalMetadata });
    }
  };
};
