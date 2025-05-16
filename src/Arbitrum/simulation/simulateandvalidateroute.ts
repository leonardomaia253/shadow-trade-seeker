
import { ethers } from "ethers";
import { BuiltRoute, SimulationResult, CallData } from "../utils/types";
import { enhancedLogger } from "../utils/enhancedLogger";
import { provider } from "../config/provider";
import axios from "axios";
import { TENDERLY_CONFIG } from "../constants/config";

/**
 * Simulate a route and validate its profitability using Tenderly simulation
 */
export async function simulateAndValidateRoute(
  route: BuiltRoute,
  userAddress: string
): Promise<SimulationResult> {
  try {
    enhancedLogger.info(`Simulating route with ${route.swaps.length} swaps`, {
      botType: "arbitrage",
      metadata: { 
        tokenIn: route.swaps[0].tokenIn,
        tokenOut: route.swaps[route.swaps.length-1].tokenOut,
      }
    });

    // Prepare the simulation payload for Tenderly API
    const simulationPayload = {
      network_id: "42161", // Arbitrum One
      from: userAddress,
      to: route.calls[0].target, // First call target
      input: route.calls[0].data, // First call data
      gas: 10000000, // Gas limit, can be adjusted
      gas_price: "0", // Use average gas price
      value: "0", // ETH value to send
      save: true, // Save simulation for later reference
      save_if_fails: true, // Save even if simulation fails
      simulation_type: "full", // Full simulation to get accurate results
      // Add state_objects to represent token balances if needed
    };

    // Call Tenderly API for simulation
    const response = await axios.post(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_CONFIG.account}/project/${TENDERLY_CONFIG.project}/simulate`,
      simulationPayload,
      {
        headers: {
          "X-Access-Key": TENDERLY_CONFIG.accessKey,
          "Content-Type": "application/json"
        }
      }
    );

    // Process simulation results
    const simulationResult = response.data?.simulation;
    if (!simulationResult) {
      throw new Error("Invalid simulation response from Tenderly");
    }

    // Extract token transfers from the simulation
    const tokenTransfers = simulationResult.transaction?.transaction_info?.token_transfers || [];
    
    // Calculate profit based on token transfers
    // We look for transfers to/from the user address
    let totalIn = ethers.BigNumber.from(0);
    let totalOut = ethers.BigNumber.from(0);
    
    tokenTransfers.forEach((transfer: any) => {
      if (transfer.to.toLowerCase() === userAddress.toLowerCase()) {
        totalIn = totalIn.add(transfer.value);
      } else if (transfer.from.toLowerCase() === userAddress.toLowerCase()) {
        totalOut = totalOut.add(transfer.value);
      }
    });
    
    // Calculate profit
    const profits = totalIn.sub(totalOut);
    
    // Generate simulation URL
    const simulationUrl = `https://dashboard.tenderly.co/simulator/${simulationResult.id}`;

    // Log result
    if (profits.gt(0)) {
      enhancedLogger.info(`Simulation successful with projected profit: ${ethers.utils.formatEther(profits)} ETH`, {
        botType: "arbitrage",
        metadata: { 
          simulationUrl,
          profits: ethers.utils.formatEther(profits)
        }
      });
    } else {
      enhancedLogger.warn(`Simulation completed but no profit detected: ${ethers.utils.formatEther(profits)} ETH`, {
        botType: "arbitrage",
        metadata: { 
          simulationUrl,
          profits: ethers.utils.formatEther(profits)
        }
      });
    }
    
    return {
      success: simulationResult.status === true,
      ok: simulationResult.status === true && profits.gt(0),
      profits,
      simulationUrl
    };
  } catch (error) {
    enhancedLogger.error(`Route simulation failed: ${error instanceof Error ? error.message : String(error)}`, {
      botType: "arbitrage",
      data: error
    });
    
    return {
      success: false,
      ok: false,
      profits: ethers.BigNumber.from(0),
      simulationUrl: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
