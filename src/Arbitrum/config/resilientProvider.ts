
import { ethers } from "ethers";
import { ReconnectingWebSocketProvider } from "../utils/websocketProvider";
import { createBackupProviders, tryWithFallback } from "../utils/securityUtils";
import { handleError } from "../utils/errorHandler";
import { createContextLogger } from "../utils/enhancedLogger";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../Arbitrum/.env") });

// Create a logger for this module
const logger = createContextLogger({
  source: "provider-factory",
  category: "infrastructure"
});

// Provider instance cache
const providerCache: Record<string, {
  primary: ReconnectingWebSocketProvider | ethers.providers.JsonRpcProvider,
  backups: ethers.providers.Provider[]
}> = {};

/**
 * Create a resilient, auto-reconnecting provider with fallbacks
 * @param chainId Ethereum chain ID
 * @returns Provider instance with auto-reconnect and fallbacks
 */
export function createResilientProvider(
  chainId: number = 42161, // Default to Arbitrum One
  primaryRpcUrl?: string,
  fallbackRpcUrls?: string[]
): ethers.providers.Provider {
  // Use cache if available
  const cacheKey = `${chainId}-${primaryRpcUrl || "default"}`;
  if (providerCache[cacheKey]) {
    return providerCache[cacheKey].primary as ethers.providers.Provider;
  }
  
  // Default URLs if not provided
  const defaultUrls = getDefaultRpcUrls(chainId);
  const primary = primaryRpcUrl || defaultUrls[0];
  const fallbacks = fallbackRpcUrls || defaultUrls.slice(1);
  
  logger.info(`Creating resilient provider for chain ${chainId}`, {
    chainId,
    primaryType: primary.startsWith("wss") ? "websocket" : "http",
    fallbackCount: fallbacks.length
  });
  
  // Create primary provider based on URL type
  let primaryProvider;
  
  if (primary.startsWith("wss:") || primary.startsWith("ws:")) {
    // Create WebSocket provider with auto-reconnect
    primaryProvider = new ReconnectingWebSocketProvider({
      urls: [primary, ...fallbacks.filter(url => url.startsWith("wss:") || url.startsWith("ws:"))],
      heartbeatInterval: 30000,
      onConnect: () => logger.info("WebSocket provider connected"),
      onDisconnect: () => logger.warn("WebSocket provider disconnected"),
      onReconnect: () => logger.info("WebSocket provider reconnecting"),
      onError: (error) => logger.error("WebSocket provider error", { error: error.message })
    });
  } else {
    // Create HTTP provider
    primaryProvider = new ethers.providers.JsonRpcProvider(primary);
    
    // Add periodic health check for HTTP provider
    setInterval(async () => {
      try {
        await primaryProvider.getBlockNumber();
      } catch (error) {
        logger.warn("HTTP provider health check failed", { error: error.message });
      }
    }, 30000);
  }
  
  // Create backup providers
  const backupProviders = createBackupProviders(fallbacks);
  
  // Store in cache
  providerCache[cacheKey] = {
    primary: primaryProvider,
    backups: backupProviders
  };
  
  // Enhance provider with fallback capability
  const enhancedProvider = new Proxy(primaryProvider, {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);
      
      // Only intercept methods (functions)
      if (typeof value === 'function') {
        return async (...args: any[]) => {
          try {
            // Try with primary provider first
            return await value.apply(target, args);
          } catch (error) {
            logger.warn(`Primary provider failed for ${String(prop)}`, { error: error.message });
            
            // Fall back to backup providers
            return await tryWithFallback(
              (provider) => {
                const method = provider[prop as keyof typeof provider];
                if (typeof method === 'function') {
                  return method.apply(provider, args);
                }
                throw new Error(`Method ${String(prop)} not found on backup provider`);
              },
              backupProviders,
              String(prop)
            );
          }
        };
      }
      
      return value;
    }
  });
  
  return enhancedProvider as ethers.providers.Provider;
}

/**
 * Get default RPC URLs for a chain
 */
function getDefaultRpcUrls(chainId: number): string[] {
  switch (chainId) {
    case 42161: // Arbitrum One
      return [
        process.env.ALCHEMY_WSS || "wss://arbitrum-mainnet.infura.io/ws/v3/o--1ruggGezl5R36rrSDX8JiVouHQOJO",
        process.env.INFURA_WSS || "wss://arbitrum-mainnet.infura.io/ws/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        "https://arb1.arbitrum.io/rpc",
        "https://arbitrum-one.public.blastapi.io"
      ];
      
    case 421613: // Arbitrum Goerli
      return [
        "wss://arb-goerli.g.alchemy.com/v2/demo",
        "https://goerli-rollup.arbitrum.io/rpc"
      ];
      
    default:
      return [
        "wss://arb-mainnet.g.alchemy.com/v2/demo",
        "https://arb1.arbitrum.io/rpc"
      ];
  }
}

/**
 * Get instance of resilient provider
 */
export function getProvider(chainId: number = 42161): ethers.providers.Provider {
  return createResilientProvider(chainId);
}

/**
 * Check health of all providers
 */
export async function checkProvidersHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'critical',
  details: Record<string, { healthy: boolean, latency?: number }>
}> {
  const results: Record<string, { healthy: boolean, latency?: number }> = {};
  let healthyCount = 0;
  let totalCount = 0;
  
  for (const cacheKey in providerCache) {
    const { primary, backups } = providerCache[cacheKey];
    totalCount += 1 + backups.length;
    
    // Check primary
    try {
      const start = Date.now();
      await (primary as ethers.providers.Provider).getBlockNumber();
      const latency = Date.now() - start;
      
      results[`primary-${cacheKey}`] = { healthy: true, latency };
      healthyCount++;
    } catch (error) {
      results[`primary-${cacheKey}`] = { healthy: false };
    }
    
    // Check backups
    for (let i = 0; i < backups.length; i++) {
      try {
        const start = Date.now();
        await backups[i].getBlockNumber();
        const latency = Date.now() - start;
        
        results[`backup-${cacheKey}-${i}`] = { healthy: true, latency };
        healthyCount++;
      } catch (error) {
        results[`backup-${cacheKey}-${i}`] = { healthy: false };
      }
    }
  }
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  
  if (healthyCount === 0) {
    status = 'critical';
  } else if (healthyCount < totalCount) {
    status = 'degraded';
  }
  
  return { status, details: results };
}
