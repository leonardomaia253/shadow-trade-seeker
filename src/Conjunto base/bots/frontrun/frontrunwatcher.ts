
import { ethers } from "ethers";
import WebSocket from 'ws';
import { getPriceImpactAndProfit } from '../../utils/profitCalc';
import { enhancedLogger } from "../../utils/enhancedLogger";
import { getDexList } from "../../utils/dexList";
import { provider } from "../../config/provider";
import { executeFrontrun } from './frontrunexecutor';

// CONFIGS
const ALCHEMY_WS = 'wss://arb-mainnet.g.alchemy.com/v2/0ryGCvDB3fihIk0PVKyU0HJuZFgPXbWW';

/**
 * Initialize and start the frontrun watcher
 */
export function startFrontrunWatcher(wallet: ethers.Wallet, options: {
  minProfitThresholdETH?: number;
  maxGasPrice?: number;
  dryRun?: boolean;
} = {}) {
  const { minProfitThresholdETH = 0.01, maxGasPrice = 100, dryRun = true } = options;

  try {
    // Connect to mempool via WebSocket
    const ws = new WebSocket(ALCHEMY_WS);
    
    // Track WebSocket connection state
    let wsActive = false;
    
    // Get DEX router addresses to monitor
    const DEX_ROUTER_ADDRESSES = getDexList(); 
    
    // Setup reconnection logic
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000;
    
    enhancedLogger.info(`[✓] Initializing mempool monitoring for frontrunning opportunities`, {
      botType: "frontrun",
      metadata: { minProfitThresholdETH, maxGasPrice, dryRun }
    });
    
    // Handle WebSocket events
    ws.on('open', () => {
      wsActive = true;
      reconnectAttempts = 0;
      enhancedLogger.info(`[+] WebSocket connected to Alchemy mempool.`, {
        botType: "frontrun"
      });
      
      // Subscribe to pending transactions
      ws.send(JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_subscribe",
        params: ["newPendingTransactions"]
      }));
    });
    
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        // Only process subscription messages
        if (parsed.method !== 'eth_subscription' || !parsed.params || !parsed.params.result) {
          return;
        }
        
        const txHash = parsed.params.result;
        processTransaction(txHash, wallet, {
          minProfitThresholdETH,
          maxGasPrice,
          dryRun,
          routerAddresses:  DEX_ROUTER
        });
        
      } catch (err) {
        enhancedLogger.error(`Error processing mempool message: ${err instanceof Error ? err.message : String(err)}`, {
          botType: "frontrun",
          data: err
        });
      }
    });
    
    ws.on('close', () => {
      wsActive = false;
      
      enhancedLogger.warn(`WebSocket connection closed. Attempting to reconnect...`, {
        botType: "frontrun",
        metadata: { reconnectAttempts }
      });
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(() => {
          if (!wsActive) {
            enhancedLogger.info(`Reconnecting to WebSocket (attempt ${reconnectAttempts})...`, {
              botType: "frontrun"
            });
            startFrontrunWatcher(wallet, options);
          }
        }, reconnectDelay * reconnectAttempts);
      } else {
        enhancedLogger.error(`Max reconnection attempts reached. WebSocket monitoring stopped.`, {
          botType: "frontrun"
        });
      }
    });
    
    ws.on('error', (error) => {
      enhancedLogger.error(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`, {
        botType: "frontrun",
        data: error
      });
      
      if (wsActive) {
        wsActive = false;
        ws.close();
      }
    });
    
    // Return cleanup function
    return () => {
      if (wsActive) {
        wsActive = false;
        ws.close();
        enhancedLogger.info(`WebSocket connection closed by user.`, {
          botType: "frontrun"
        });
      }
    };
    
  } catch (err) {
    enhancedLogger.error(`Error starting frontrun watcher: ${err instanceof Error ? err.message : String(err)}`, {
      botType: "frontrun",
      data: err
    });
    return () => {}; // Empty cleanup function
  }
}

/**
 * Process a single transaction from the mempool
 */
async function processTransaction(txHash: string, wallet: ethers.Wallet, options: {
  minProfitThresholdETH: number;
  maxGasPrice: number;
  dryRun: boolean;
  routerAddresses: string[];
}) {
  const { minProfitThresholdETH, maxGasPrice, dryRun, routerAddresses } = options;
  
  try {
    // Get transaction details
    const txDetails = await provider.getTransaction(txHash);
    if (!txDetails || !txDetails.to || !txDetails.data) return;
    
    // Check if transaction is to a DEX router
    const isDexTransaction = routerAddresses.some(
      addr => txDetails.to?.toLowerCase() === addr.toLowerCase()
    );
    
    if (!isDexTransaction) return;
    
    enhancedLogger.debug(`Detected DEX tx in mempool: ${txHash}`, {
      botType: "frontrun",
      txHash: txHash
    });
    
    // Analyze potential profit from frontrunning
    const profitData = await getPriceImpactAndProfit(txDetails);
    if (!profitData || profitData.profit.lte(ethers.utils.parseEther(minProfitThresholdETH.toString()))) {
      return;
    }
    
    // Check gas price
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(txDetails.gasPrice || 0, "gwei"));
    if (gasPriceGwei > maxGasPrice) {
      enhancedLogger.debug(`Gas price too high for frontrunning: ${gasPriceGwei} gwei > ${maxGasPrice} gwei`, {
        botType: "frontrun",
        txHash: txHash
      });
      return;
    }
    
    // Calculate profit in ETH
    const profitEth = parseFloat(ethers.utils.formatEther(profitData.profit));
    
    enhancedLogger.info(`[🚨] Frontrun opportunity detected - Estimated profit: ${profitEth.toFixed(4)} ETH`, {
      botType: "frontrun",
      txHash: txHash,
      metadata: {
        profit: profitEth,
        priceImpact: profitData.priceImpactBps / 100 + "%"
      }
    });
    
    // Execute frontrun
    const result = await executeFrontrun({
      wallet,
      victimTxHash: txHash,
      dex: profitData.dex,
      targetToken: profitData.tokenOut,
      impactEstimate: {
        tokenIn: profitData.tokenIn,
        tokenOut: profitData.tokenOut,
        amountIn: profitData.amountIn.toString(),
        amountOut: profitData.amountOut.toString(),
        priceImpactBps: profitData.priceImpactBps
      },
      gasPrice: (gasPriceGwei * 1.1).toFixed(1),
      simulateOnly: dryRun
    });
    
    if (result && result.status === "success") {
      enhancedLogger.success(`✅ Frontrun executed successfully! TX: ${result.txHash}`, {
        botType: "frontrun",
        txHash: result.txHash
      });
    } else if (result && result.status === "simulated") {
      enhancedLogger.info(`✓ Frontrun simulated (dry run). Profit estimate: ${profitEth.toFixed(4)} ETH`, {
        botType: "frontrun",
        txHash: txHash
      });
    } else {
      enhancedLogger.warn(`❌ Frontrun failed or was rejected`, {
        botType: "frontrun",
        txHash: txHash,
        data: result
      });
    }
    
  } catch (err) {
    enhancedLogger.error(`Error processing transaction: ${txHash} - ${err instanceof Error ? err.message : String(err)}`, {
      botType: "frontrun",
      txHash: txHash,
      data: err
    });
  }
}

