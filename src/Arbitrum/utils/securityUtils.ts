
import { ethers } from "ethers";
import { CircuitBreaker, handleError } from "./errorHandler";
import { LRUCache } from "lru-cache";

// Cache for recent transactions to prevent duplicates
const recentTxCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Cache for recent block prices
const blockPriceCache = new LRUCache<number, {
  gasPrice: ethers.BigNumber,
  baseFee?: ethers.BigNumber,
  timestamp: number
}>({
  max: 100,
  ttl: 1000 * 60 * 10, // 10 minutes
});

// Circuit breakers for each protection
const priceCircuitBreaker = new CircuitBreaker(3, 300000, "security");
const gasCircuitBreaker = new CircuitBreaker(3, 180000, "security");
const flashbotCircuitBreaker = new CircuitBreaker(3, 240000, "security");

/**
 * Validate a transaction doesn't exceed parameters
 */
export async function validateTransaction(
  provider: ethers.providers.Provider,
  to: string,
  data: string,
  value: ethers.BigNumberish = 0,
  maxGasPrice: number = 100, // in gwei
  maxGas: number = 3000000
): Promise<{
  valid: boolean;
  reason?: string;
  gasPrice?: ethers.BigNumber;
  gasEstimate?: ethers.BigNumber;
}> {
  try {
    // Check if this is a duplicate transaction
    const txKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes", "uint256"],
        [to, data, value]
      )
    );
    
    if (recentTxCache.has(txKey)) {
      return {
        valid: false,
        reason: "Duplicate transaction detected"
      };
    }
    
    // Get current gas price
    const gasPrice = await priceCircuitBreaker.execute(
      async () => await provider.getGasPrice(),
      "getGasPrice"
    );
    
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, "gwei"));
    
    // Check if gas price is reasonable
    if (gasPriceGwei > maxGasPrice) {
      return {
        valid: false,
        reason: `Gas price too high: ${gasPriceGwei.toFixed(2)} gwei > ${maxGasPrice} gwei`,
        gasPrice
      };
    }
    
    // Check for sudden gas spikes (potential frontrunning)
    const latestBlock = await provider.getBlockNumber();
    const previousBlock = latestBlock - 1;
    
    const previousBlockData = blockPriceCache.get(previousBlock);
    if (previousBlockData && previousBlockData.gasPrice) {
      const previousGasGwei = parseFloat(
        ethers.utils.formatUnits(previousBlockData.gasPrice, "gwei")
      );
      
      // If gas price has increased by more than 50% in one block, be cautious
      if (gasPriceGwei > previousGasGwei * 1.5) {
        console.warn(
          `⚠️ Gas price spike detected: ${previousGasGwei.toFixed(2)} -> ${gasPriceGwei.toFixed(2)} gwei`
        );
      }
    }
    
    // Store current gas price in cache
    blockPriceCache.set(latestBlock, {
      gasPrice,
      timestamp: Date.now()
    });
    
    // Estimate gas
    const gasEstimate = await gasCircuitBreaker.execute(
      async () => {
        return await provider.estimateGas({
          to,
          data,
          value
        });
      },
      "estimateGas"
    );
    
    // Check if gas estimate is reasonable
    if (gasEstimate.gt(ethers.BigNumber.from(maxGas))) {
      return {
        valid: false,
        reason: `Gas estimate too high: ${gasEstimate.toString()} > ${maxGas}`,
        gasEstimate
      };
    }
    
    // Transaction is valid, add to recent tx cache
    recentTxCache.set(txKey, true);
    
    return {
      valid: true,
      gasPrice,
      gasEstimate
    };
    
  } catch (error) {
    console.error("Error validating transaction:", error);
    return {
      valid: false,
      reason: `Validation error: ${error.message || String(error)}`
    };
  }
}

/**
 * Detect if there are signs of price manipulation on a token
 */
export async function detectPriceManipulation(
  tokenAddress: string,
  provider: ethers.providers.Provider,
  threshold: number = 5 // 5% change in short time is suspicious
): Promise<{
  suspicious: boolean;
  reason?: string;
}> {
  // This would normally involve checking recent trades, liquidity changes, etc.
  // For now, we'll implement a simple placeholder
  return {
    suspicious: false
  };
}

/**
 * Rate limiting to prevent excessive operations
 */
export class RateLimiter {
  private operations: Map<string, { count: number, resetTime: number }> = new Map();
  
  constructor(
    private readonly limit: number = 10,
    private readonly windowMs: number = 60000 // 1 minute
  ) {}
  
  /**
   * Check if operation is allowed
   * @param operation Identifier for the operation
   * @returns true if operation is allowed, false if it's rate limited
   */
  isAllowed(operation: string): boolean {
    const now = Date.now();
    const current = this.operations.get(operation);
    
    if (!current || now > current.resetTime) {
      // First operation or window expired, reset counter
      this.operations.set(operation, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }
    
    if (current.count < this.limit) {
      // Increment counter
      this.operations.set(operation, {
        count: current.count + 1,
        resetTime: current.resetTime
      });
      return true;
    }
    
    // Rate limit exceeded
    return false;
  }
  
  /**
   * Get remaining operations allowed in current window
   */
  remaining(operation: string): number {
    const now = Date.now();
    const current = this.operations.get(operation);
    
    if (!current || now > current.resetTime) {
      return this.limit;
    }
    
    return Math.max(0, this.limit - current.count);
  }
}

// Export a global rate limiter instance
export const globalRateLimiter = new RateLimiter();

/**
 * Create backup/alternate providers for resilience
 */
export function createBackupProviders(
  urls: string[]
): ethers.providers.Provider[] {
  return urls.map((url) => {
    if (url.startsWith("wss:") || url.startsWith("ws:")) {
      return new ethers.providers.WebSocketProvider(url);
    } else {
      return new ethers.providers.JsonRpcProvider(url);
    }
  });
}

/**
 * Try a function with multiple providers until one succeeds
 */
export async function tryWithFallback<T>(
  fn: (provider: ethers.providers.Provider) => Promise<T>,
  providers: ethers.providers.Provider[],
  operationName: string
): Promise<T> {
  let lastError: Error | undefined;
  
  for (const provider of providers) {
    try {
      return await fn(provider);
    } catch (error) {
      console.warn(`Provider failed for ${operationName}:`, error.message);
      lastError = error;
    }
  }
  
  // If we reach here, all providers failed
  throw new Error(
    `All providers failed for ${operationName}: ${lastError?.message || "unknown error"}`
  );
}
