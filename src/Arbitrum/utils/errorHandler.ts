
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { enhancedLogger } from "./enhancedLogger";

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Categorized error types
export enum ErrorCategory {
  NETWORK = "network",
  CONTRACT = "contract",
  TRANSACTION = "transaction",
  API = "api",
  SLIPPAGE = "slippage",
  SIMULATION = "simulation",
  SECURITY = "security",
  SYSTEM = "system",
  UNKNOWN = "unknown"
}

// Specific error types
export enum ErrorType {
  // Network errors
  RPC_CONNECTION = "rpc_connection",
  TIMEOUT = "timeout",
  RATE_LIMIT = "rate_limit",
  
  // Contract errors
  EXECUTION_REVERTED = "execution_reverted",
  OUT_OF_GAS = "out_of_gas",
  INVALID_OPCODE = "invalid_opcode",
  
  // Transaction errors
  NONCE_TOO_LOW = "nonce_too_low",
  REPLACEMENT_UNDERPRICED = "replacement_underpriced",
  GAS_PRICE_TOO_LOW = "gas_price_too_low",
  
  // API errors
  API_ERROR = "api_error",
  REQUEST_FAILED = "request_failed",
  
  // Slippage errors
  EXCESSIVE_SLIPPAGE = "excessive_slippage",
  PRICE_IMPACT_TOO_HIGH = "price_impact_too_high",
  
  // Simulation errors
  SIMULATION_FAILED = "simulation_failed",
  
  // Security errors
  PRICE_MANIPULATION = "price_manipulation",
  FRONTRUN_DETECTED = "frontrun_detected",
  SANDWICH_ATTACK = "sandwich_attack",
  
  // System errors
  OUT_OF_MEMORY = "out_of_memory",
  PROCESS_ERROR = "process_error",
  
  // Unknown
  UNKNOWN_ERROR = "unknown_error"
}

// Error handling configuration
interface ErrorHandlerConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  botType: string;
  logToDb: boolean;
}

// Default configuration
const defaultConfig: ErrorHandlerConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  botType: "unknown",
  logToDb: true
};

/**
 * Determines error category and type based on error message or object
 */
export function categorizeError(error: any): { category: ErrorCategory; type: ErrorType } {
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorString = String(error).toLowerCase();
  
  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("etimedout")
  ) {
    if (errorMessage.includes("timeout")) {
      return { category: ErrorCategory.NETWORK, type: ErrorType.TIMEOUT };
    }
    if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
      return { category: ErrorCategory.NETWORK, type: ErrorType.RATE_LIMIT };
    }
    return { category: ErrorCategory.NETWORK, type: ErrorType.RPC_CONNECTION };
  }
  
  // Contract errors
  if (
    errorMessage.includes("execution reverted") ||
    errorMessage.includes("revert") ||
    errorMessage.includes("out of gas") ||
    errorMessage.includes("invalid opcode")
  ) {
    if (errorMessage.includes("out of gas")) {
      return { category: ErrorCategory.CONTRACT, type: ErrorType.OUT_OF_GAS };
    }
    if (errorMessage.includes("invalid opcode")) {
      return { category: ErrorCategory.CONTRACT, type: ErrorType.INVALID_OPCODE };
    }
    return { category: ErrorCategory.CONTRACT, type: ErrorType.EXECUTION_REVERTED };
  }
  
  // Transaction errors
  if (
    errorMessage.includes("nonce too low") ||
    errorMessage.includes("replacement transaction underpriced") ||
    errorMessage.includes("gas price too low")
  ) {
    if (errorMessage.includes("nonce too low")) {
      return { category: ErrorCategory.TRANSACTION, type: ErrorType.NONCE_TOO_LOW };
    }
    if (errorMessage.includes("replacement transaction underpriced")) {
      return { category: ErrorCategory.TRANSACTION, type: ErrorType.REPLACEMENT_UNDERPRICED };
    }
    return { category: ErrorCategory.TRANSACTION, type: ErrorType.GAS_PRICE_TOO_LOW };
  }
  
  // API errors
  if (errorMessage.includes("api") || errorMessage.includes("request failed")) {
    return { category: ErrorCategory.API, type: ErrorType.API_ERROR };
  }
  
  // Slippage errors
  if (
    errorMessage.includes("slippage") ||
    errorMessage.includes("price impact")
  ) {
    if (errorMessage.includes("price impact")) {
      return { category: ErrorCategory.SLIPPAGE, type: ErrorType.PRICE_IMPACT_TOO_HIGH };
    }
    return { category: ErrorCategory.SLIPPAGE, type: ErrorType.EXCESSIVE_SLIPPAGE };
  }
  
  // Simulation errors
  if (errorMessage.includes("simulation")) {
    return { category: ErrorCategory.SIMULATION, type: ErrorType.SIMULATION_FAILED };
  }
  
  // Security errors
  if (
    errorMessage.includes("manipulation") ||
    errorMessage.includes("frontrun") ||
    errorMessage.includes("sandwich")
  ) {
    if (errorMessage.includes("frontrun")) {
      return { category: ErrorCategory.SECURITY, type: ErrorType.FRONTRUN_DETECTED };
    }
    if (errorMessage.includes("sandwich")) {
      return { category: ErrorCategory.SECURITY, type: ErrorType.SANDWICH_ATTACK };
    }
    return { category: ErrorCategory.SECURITY, type: ErrorType.PRICE_MANIPULATION };
  }
  
  // System errors
  if (
    errorMessage.includes("memory") ||
    errorMessage.includes("heap") ||
    errorMessage.includes("process")
  ) {
    if (errorMessage.includes("memory") || errorMessage.includes("heap")) {
      return { category: ErrorCategory.SYSTEM, type: ErrorType.OUT_OF_MEMORY };
    }
    return { category: ErrorCategory.SYSTEM, type: ErrorType.PROCESS_ERROR };
  }
  
  // Default: unknown
  return { category: ErrorCategory.UNKNOWN, type: ErrorType.UNKNOWN_ERROR };
}

/**
 * Enhanced error handling with retry logic, logging, and monitoring
 */
export async function handleError<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: Partial<ErrorHandlerConfig> = {}
): Promise<T> {
  const fullConfig: ErrorHandlerConfig = { ...defaultConfig, ...config };
  let attempt = 0;
  let lastError: any;
  
  while (attempt < fullConfig.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      lastError = error;
      
      // Categorize error
      const { category, type } = categorizeError(error);
      
      // Log error
      const logger = enhancedLogger;
      logger.error(`${operationName} failed (attempt ${attempt}/${fullConfig.maxRetries})`, {
        category: category,
        errorType: type,
        operationName,
        attempt,
        maxRetries: fullConfig.maxRetries,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        botType: fullConfig.botType
      });
      
      // Log to database if configured
      if (fullConfig.logToDb) {
        try {
          await supabase.from("bot_logs").insert({
            level: "error",
            message: `${operationName} failed: ${error.message || String(error)}`,
            category: "exception",
            bot_type: fullConfig.botType,
            source: "error_handler",
            metadata: {
              errorCategory: category,
              errorType: type,
              attempt,
              maxRetries: fullConfig.maxRetries,
              stack: error.stack
            }
          });
        } catch (logError) {
          console.error("Failed to log error to database:", logError);
        }
      }
      
      // If this is not the last attempt, wait before retrying
      if (attempt < fullConfig.maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          fullConfig.initialDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random()),
          fullConfig.maxDelay
        );
        
        console.log(`Retrying ${operationName} in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Some errors should not be retried
      if (
        type === ErrorType.NONCE_TOO_LOW ||
        type === ErrorType.OUT_OF_GAS ||
        type === ErrorType.EXCESSIVE_SLIPPAGE ||
        type === ErrorType.PRICE_IMPACT_TOO_HIGH ||
        type === ErrorType.PRICE_MANIPULATION ||
        type === ErrorType.FRONTRUN_DETECTED ||
        type === ErrorType.SANDWICH_ATTACK
      ) {
        console.log(`Not retrying ${operationName} due to error type: ${type}`);
        break;
      }
    }
  }
  
  // If we reached here, all attempts failed
  throw lastError;
}

/**
 * Circuit breaker to prevent repeated failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private isOpen: boolean = false;
  
  constructor(
    private readonly maxFailures: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly botType: string = "unknown"
  ) {}
  
  async execute<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    // Check if circuit is open
    if (this.isOpen) {
      // Check if it's time to try again (half-open state)
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        console.log(`Circuit for ${operationName} is half-open, attempting reset...`);
        this.isOpen = false;
      } else {
        console.log(`Circuit for ${operationName} is open, skipping operation`);
        throw new Error(`Circuit breaker open for ${operationName}`);
      }
    }
    
    try {
      // Attempt to execute function
      const result = await fn();
      
      // Success - reset failure count
      this.failures = 0;
      return result;
      
    } catch (error) {
      // Record failure
      this.failures++;
      this.lastFailure = Date.now();
      
      // Log the failure
      enhancedLogger.error(`Circuit breaker: ${operationName} failed`, {
        botType: this.botType,
        failures: this.failures,
        maxFailures: this.maxFailures,
        errorMessage: error.message || String(error)
      });
      
      // Check if we should open the circuit
      if (this.failures >= this.maxFailures) {
        this.isOpen = true;
        
        // Log circuit opened
        enhancedLogger.warn(`Circuit breaker opened for ${operationName}`, {
          botType: this.botType,
          failures: this.failures,
          resetTimeout: this.resetTimeout
        });
        
        // Log to database
        try {
          await supabase.from("bot_logs").insert({
            level: "warn",
            message: `Circuit breaker opened for ${operationName}`,
            category: "circuit_breaker",
            bot_type: this.botType,
            source: "error_handler",
            metadata: {
              failures: this.failures,
              maxFailures: this.maxFailures,
              resetTimeout: this.resetTimeout
            }
          });
        } catch (logError) {
          console.error("Failed to log circuit breaker state to database:", logError);
        }
      }
      
      // Re-throw the error
      throw error;
    }
  }
}
