
import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { LiquidationOpportunity } from "../../utils/types";
import { getAaveLiquidationOpportunities } from "./finder/AaveAll";
import { getCompoundLiquidationOpportunities } from "./finder/CompoundAll";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../Arbitrum/.env") });

// Create a provider
const provider = new ethers.providers.JsonRpcProvider("https://arb-mainnet.g.alchemy.com/v2/demo");

// Track found positions
const _foundPositions: Map<string, LiquidationOpportunity> = new Map();

// Get liquidation opportunities for a specific protocol
export async function getLiquidationOpportunities(
  protocol: string,
  provider: JsonRpcProvider,
  minProfitUsd = 100
): Promise<LiquidationOpportunity[]> {
  try {
    let opportunities: LiquidationOpportunity[] = [];
    
    switch (protocol.toLowerCase()) {
      case 'aave':
        opportunities = await getAaveLiquidationOpportunities(provider, minProfitUsd);
        break;
      case 'compound':
        const compoundOpps = await getCompoundLiquidationOpportunities(provider, minProfitUsd);
        opportunities = compoundOpps.map(opp => ({
          protocol: "compound",
          userAddress: opp.user,
          collateralAsset: opp.collateral?.length ? opp.collateral[0].token : null,
          debtAsset: opp.debt?.length ? opp.debt[0].token : null,
          collateralAmount: opp.collateral?.length ? opp.collateral[0].amount : 0,
          debtAmount: opp.debt?.length ? opp.debt[0].amount : 0,
          healthFactor: opp.shortfallETH ? (1 - opp.shortfallETH / (opp.collateral?.reduce((sum, item) => sum + item.amount, 0) || 1)) : 0,
          expectedProfit: opp.collateral?.length ? opp.collateral[0].amount * 0.05 : 0 // Estimate 5% profit
        }));
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
