
import axios from "axios";
import { ethers } from "ethers";

export async function simulateBundleWithTenderly(
  // Accept serialized transactions as strings instead of requiring a provider
  serializedTransactions: string[],
  networkId: string = "42161" // Default to Arbitrum
): Promise<{ success: boolean; results?: any; error?: string }> {
  try {
    const TENDERLY_USER = process.env.TENDERLY_USER || "demo";
    const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT || "project";
    const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY || "";

    const endpoint = `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`;
    
    // Bundle simulation request
    const body = {
      network_id: networkId, // Configurable network ID
      save: false, // Don't save simulation to dashboard
      save_if_fails: true, // Save if simulation fails
      simulation_type: "quick", // Fast simulation mode
      transactions: serializedTransactions.map(tx => ({
        raw_tx: tx,
        network_id: networkId
      }))
    };

    const headers = {
      "Content-Type": "application/json",
      "X-Access-Key": TENDERLY_ACCESS_KEY
    };

    const response = await axios.post(endpoint, body, { headers });

    if (response.status === 200 && response.data) {
      // Check if any transaction failed
      const simulationFailed = response.data.simulation_results.some(
        (simResult: any) => simResult.status === false
      );
      
      return {
        success: !simulationFailed,
        results: response.data
      };
    }
    
    return {
      success: false,
      error: "Invalid response from Tenderly API",
      results: response.data
    };
    
  } catch (error: any) {
    console.error("Error in Tenderly simulation:", error);
    return {
      success: false,
      error: error.message || "Unknown error in Tenderly simulation"
    };
  }
}
