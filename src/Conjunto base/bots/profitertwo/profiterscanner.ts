
import { ethers } from "ethers";
import { provider, wallet } from "../../config/provider";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { buildArbitrageRoute } from "./ArbBuilder";
import { executeArbitrage } from "./executor";
import { DexType } from "../../utils/types";

// Bot state
let isScanning = false;
let scanInterval: NodeJS.Timeout | null = null;

// Scanner configuration
interface ScannerConfig {
  tokens: string[];
  dexes: string[];
  maxHops: number;
  minProfitUsd: number;
  scanInterval: number;
}

// Start scanning for arbitrage opportunities
export function startArbScanner(config: ScannerConfig): void {
  if (isScanning) {
    stopArbScanner();
  }
  
  isScanning = true;
  
  enhancedLogger.logEvent("info", "Starting arbitrage scanner", {
    category: "system",
    botType: "profiter",
    metadata: {
      tokens: config.tokens.length,
      dexes: config.dexes,
      maxHops: config.maxHops
    }
  });
  
  // Initial scan
  scanForArbitrageOpportunities(config);
  
  // Set up interval for regular scanning
  scanInterval = setInterval(() => {
    scanForArbitrageOpportunities(config);
  }, config.scanInterval);
}

// Stop scanning
export function stopArbScanner(): void {
  isScanning = false;
  
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  
  enhancedLogger.logEvent("info", "Arbitrage scanner stopped", {
    category: "system",
    botType: "profiter"
  });
}

// Scan for arbitrage opportunities
async function scanForArbitrageOpportunities(config: ScannerConfig): Promise<void> {
  if (!isScanning) return;
  
  try {
    enhancedLogger.logEvent("debug", "Scanning for arbitrage opportunities", {
      category: "detection",
      botType: "profiter"
    });
    
    // For each token as the start of a route
    for (const baseToken of config.tokens) {
      // Skip if scanner has been stopped
      if (!isScanning) return;
      
      try {
        // Build potential arbitrage route starting with this token
        const route = await buildArbitrageRoute({
          startToken: baseToken,
          tokens: config.tokens,
          dexes: config.dexes as DexType[],
          maxHops: config.maxHops,
          minProfitUsd: config.minProfitUsd
        });
        
        // If a profitable route is found, execute it
        if (route && route.expectedProfit.gt(0)) {
          enhancedLogger.logEvent("info", `Found profitable arbitrage route with expected profit: ${ethers.utils.formatEther(route.expectedProfit)} ETH`, {
            category: "opportunity",
            botType: "profiter",
            metadata: {
              path: route.path.join(' -> '),
              profitEth: ethers.utils.formatEther(route.expectedProfit),
              profitUsd: route.profitUsd
            }
          });
          
          // Execute the arbitrage
          if (wallet) {
            await executeArbitrage({
              provider,
              signer: wallet,
              builtRoute: route,
              flashloanToken: baseToken,
              flashloanAmount: ethers.utils.parseEther("15"), // 1 ETH equivalent
              minerBribeAmount: route.expectedProfit.div(50) // 10% to miner
            });
          }
        }
      } catch (error) {
        enhancedLogger.logEvent("error", `Error scanning for arbitrage opportunities with token ${baseToken}: ${error instanceof Error ? error.message : "Unknown error"}`, {
          category: "detection",
          botType: "profiter",
          data: error
        });
      }
      
      // Brief pause between token scans to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    enhancedLogger.logEvent("error", `Error in arbitrage scanner: ${error instanceof Error ? error.message : "Unknown error"}`, {
      category: "system",
      botType: "profiter",
      data: error
    });
  }
}
