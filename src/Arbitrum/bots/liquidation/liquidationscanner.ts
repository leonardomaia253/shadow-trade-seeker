
import { ethers } from "ethers";
import { provider } from "../../provider";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { LiquidationOpportunity } from "../../utils/types";
import { getAaveLiquidationOpportunities } from "./finder/AaveAll";
import { getCompoundLiquidationOpportunities } from "./finder/CompoundAll";

// Track found positions
const _foundPositions: Map<string, LiquidationOpportunity> = new Map();

// Get liquidation opportunities for a specific protocol
export async function getLiquidationOpportunities(
  protocol: string,
  provider: ethers.providers.Provider,
  minProfitUsd = 100
): Promise<LiquidationOpportunity[]> {
  try {
    let opportunities: LiquidationOpportunity[] = [];
    
    switch (protocol.toLowerCase()) {
      case 'aave':
        opportunities = await getAaveLiquidationOpportunities(provider, minProfitUsd);
        break;
      case 'compound':
        opportunities = await getCompoundLiquidationOpportunities(provider, minProfitUsd);
        break;
      // Add other protocols as needed
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
    
    // Store found positions
    for (const opp of opportunities) {
      const key = `${opp.protocol}-${opp.userAddress}`;
      _foundPositions.set(key, opp);
    }
    
    return opportunities;
    
  } catch (error) {
    enhancedLogger.error(`Error scanning ${protocol}: ${error instanceof Error ? error.message : String(error)}`, {
      category: "error",
      botType: "liquidation",
      source: protocol,
      component: "scanner",
      data: error
    });
    return [];
  }
}

// Get previously found positions for a protocol
export function getFoundPositions(protocol?: string): LiquidationOpportunity[] {
  if (!protocol) {
    return Array.from(_foundPositions.values());
  }
  
  return Array.from(_foundPositions.values()).filter(
    pos => pos.protocol.toLowerCase() === protocol.toLowerCase()
  );
}

// Manually trigger a scan
export async function triggerManualScan(
  protocols: string[],
  minProfitUsd = 100
): Promise<Record<string, LiquidationOpportunity[]>> {
  const results: Record<string, LiquidationOpportunity[]> = {};
  
  for (const protocol of protocols) {
    results[protocol] = await getLiquidationOpportunities(protocol, provider, minProfitUsd);
  }
  
  return results;
}
