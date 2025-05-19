import axios from 'axios';
import { ethers } from 'ethers';
import { createContextLogger } from './enhancedLogger';
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../Arbitrum/.env") });


// Create a context-aware logger for this module
const log = createContextLogger({
  source: 'tenderly-simulation'
});

// Constants for Tenderly API
const TENDERLY_USER = process.env.TENDERLY_USER || '';
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT || '';
const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY || '';
const TENDERLY_BASE_URL = 'https://api.tenderly.co/api/v1';

/**
 * Enhanced simulation with Tenderly
 * @param transactions Array of raw signed transactions to simulate
 * @param options Optional configurations for the simulation
 * @returns Simulation results
 */
export async function simulateBundleWithTenderly(
  transactions: string[],
  options: {
    blockNumber?: number;
    networkId?: string;
    save?: boolean;
    description?: string;
    gasPrice?: string;
    gasLimit?: string;
  } = {}
): Promise<{
  success: boolean;
  error?: string;
  results?: any;
  gasUsed?: string;
  simulation_id?: string;
}> {
  try {
    if (!TENDERLY_USER || !TENDERLY_PROJECT || !TENDERLY_ACCESS_KEY) {
      throw new Error("Missing Tenderly API credentials");
    }

    log.info("Starting Tenderly simulation", {
      category: "simulation",
      txCount: transactions.length,
      options: {
        blockNumber: options.blockNumber,
        networkId: options.networkId || '42161', // Default to Arbitrum
        save: options.save,
      }
    });

    // Prepare simulation payload
    const simulationPayload = {
      network_id: options.networkId || '42161', // Arbitrum
      block_number: options.blockNumber, // Use latest if undefined
      transaction_index: null,
      from: null,
      to: null,
      input: null,
      gas: options.gasLimit || 30000000,
      gas_price: options.gasPrice || '0',
      value: '0',
      save: options.save === undefined ? true : options.save,
      save_if_fails: true,
      simulation_type: "full",
      source: "arbitrum-mev-bot",
      description: options.description || "MEV Bot Bundle Simulation",
      generate_access_list: true,
      block_header: null,
      state_objects: null,
      addresses_to_track: [],
      root: null,
      block_header_override: null,
      initial_balance: null,
      project_slug: TENDERLY_PROJECT,
    };

    // Process transactions
    const processedTransactions = await Promise.all(transactions.map(async (tx) => {
      // If tx is already a raw tx string, use it directly
      if (typeof tx === 'string' && tx.startsWith('0x')) {
        return { raw_tx: tx };
      }
      
      // Otherwise parse it as an ethers transaction
      return { raw_tx: tx };
    }));

    // Prepare the final simulation request
    const simulationRequest = {
      ...simulationPayload,
      transactions: processedTransactions,
      type: "bundle", // This is a bundle simulation
    };

    log.debug("Sending simulation request to Tenderly", {
      category: "simulation",
      request: {
        ...simulationRequest,
        transactions: `${processedTransactions.length} transactions`
      }
    });

    // Send the simulation request to Tenderly API
    const simulationUrl = `${TENDERLY_BASE_URL}/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate-bundle`;
    const response = await axios.post(simulationUrl, simulationRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': TENDERLY_ACCESS_KEY,
      },
    });

    // Check if the simulation was successful
    if (response.status === 200 && response.data) {
      const simulationData = response.data;
      const success = !simulationData.simulation.status || simulationData.simulation.status === false;
      
      // Detailed logging based on simulation results
      if (success) {
        log.info("Tenderly simulation completed successfully", {
          category: "simulation",
          simulationId: simulationData.simulation.id,
          blockNumber: simulationData.simulation.block_number,
          gasUsed: simulationData.transaction.gas_used,
          callTrace: simulationData.transaction.call_trace ? "Available" : "Not available",
          txCount: transactions.length
        });
        
        // Extract important information from the simulation results
        let totalGasUsed = 0;
        let profitEstimate = 0;
        
        if (simulationData.transaction && Array.isArray(simulationData.transaction.transaction_info)) {
          simulationData.transaction.transaction_info.forEach((txInfo: any) => {
            if (txInfo.gas_used) {
              totalGasUsed += parseInt(txInfo.gas_used, 10);
            }
          });
        }
        
        // Log detailed profitability metrics if available
        log.debug("Simulation profit metrics", {
          category: "simulation_metrics",
          totalGasUsed,
          profitEstimate,
          simulationId: simulationData.simulation.id
        });
        
        return {
          success: true,
          results: simulationData,
          gasUsed: totalGasUsed.toString(),
          simulation_id: simulationData.simulation.id,
        };
      } else {
        // Handle failed simulation
        const errorMessage = simulationData.transaction?.error_message || 'Unknown error in simulation';
        
        log.warn("Tenderly simulation failed", {
          category: "simulation",
          simulationId: simulationData.simulation?.id,
          error: errorMessage,
          txCount: transactions.length,
          status: simulationData.simulation?.status
        });
        
        return {
          success: false,
          error: errorMessage,
          results: simulationData,
          simulation_id: simulationData.simulation?.id,
        };
      }
    }

    // Handle unexpected response format
    log.error("Unexpected Tenderly API response", {
      category: "api_error",
      status: response.status,
      responseData: response.data ? "Available" : "Empty"
    });
    
    return {
      success: false,
      error: `Unexpected API response: ${response.status}`,
    };
  } catch (error: any) {
    // Handle API errors or network issues
    log.error(`Tenderly simulation error: ${error.message}`, {
      category: "exception",
      errorMessage: error.message,
      stack: error.stack,
      response: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : "No response data"
    });
    
    return {
      success: false,
      error: `Simulation error: ${error.message}`,
    };
  }
}

/**
 * Estimate the profitability of a bundle using Tenderly simulation
 * @param transactions Array of raw signed transactions to simulate
 * @param watchAddress Address to track for balance changes
 * @param options Optional configurations 
 */
export async function estimateBundleProfitability(
  transactions: string[],
  watchAddress: string,
  options: {
    tokenAddress?: string;
    ethPrice?: number;
    networkId?: string;
  } = {}
): Promise<{
  profitable: boolean;
  profitWei?: ethers.BigNumber;
  profitUsd?: number;
  gasUsed?: string;
  error?: string;
}> {
  try {
    log.info("Estimating bundle profitability", {
      category: "profitability",
      txCount: transactions.length,
      watchAddress,
      tokenAddress: options.tokenAddress || 'ETH'
    });
    
    // Run simulation with address tracking
    const simulation = await simulateBundleWithTenderly(
      transactions,
      {
        networkId: options.networkId || '42161',
        save: false,
        description: "Profitability estimation"
      }
    );
    
    if (!simulation.success) {
      return {
        profitable: false,
        error: simulation.error
      };
    }
    
    // Extract balance changes for the watched address
    let balanceChange = ethers.BigNumber.from(0);
    let gasUsed = ethers.BigNumber.from(0);
    
    // Process simulation results to find balance changes
    // This is a simplified implementation - would need to be adapted to Tenderly's actual response format
    if (simulation.results && simulation.results.balance_changes) {
      const addressChanges = simulation.results.balance_changes[watchAddress.toLowerCase()];
      if (addressChanges) {
        if (options.tokenAddress) {
          // For ERC20 tokens
          const tokenChanges = addressChanges[options.tokenAddress.toLowerCase()];
          if (tokenChanges) {
            balanceChange = ethers.BigNumber.from(tokenChanges);
          }
        } else {
          // For ETH
          balanceChange = ethers.BigNumber.from(addressChanges.eth || 0);
        }
      }
    }
    
    // Get gas used
    if (simulation.gasUsed) {
      gasUsed = ethers.BigNumber.from(simulation.gasUsed);
    }
    
    // Calculate profitability
    const gasPrice = ethers.utils.parseUnits("0.1", "gwei"); // Example gas price
    const gasCost = gasUsed.mul(gasPrice);
    
    // Net profit = balance change - gas cost
    const netProfit = balanceChange.sub(gasCost);
    
    // Convert to USD if ethPrice is provided
    let profitUsd;
    if (options.ethPrice) {
      profitUsd = parseFloat(ethers.utils.formatEther(netProfit)) * options.ethPrice;
    }
    
    const isProfitable = netProfit.gt(0);
    
    log.info("Bundle profitability estimate", {
      category: "profitability",
      profitable: isProfitable,
      profitWei: netProfit.toString(),
      profitEth: ethers.utils.formatEther(netProfit),
      profitUsd,
      gasUsed: gasUsed.toString(),
      gasCost: gasCost.toString()
    });
    
    return {
      profitable: isProfitable,
      profitWei: netProfit,
      profitUsd,
      gasUsed: gasUsed.toString()
    };
  } catch (error: any) {
    log.error(`Error estimating profitability: ${error.message}`, {
      category: "exception",
      errorMessage: error.message,
      stack: error.stack
    });
    
    return {
      profitable: false,
      error: `Estimation error: ${error.message}`
    };
  }
}
