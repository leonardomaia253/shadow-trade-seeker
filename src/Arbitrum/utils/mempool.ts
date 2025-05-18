import { ethers } from "ethers";
import { wsRpcUrl } from "./config";
import { enhancedLogger } from "./enhancedLogger";

/**
 * Sets up a WebSocket listener for the mempool
 * @param onTransaction Callback function to execute when a transaction is detected
 * @param targetAddresses Array of addresses to filter transactions for (optional)
 * @returns Object with provider and stop method
 */
export function listenMempool(
  onTransaction: (tx: ethers.providers.TransactionResponse) => Promise<void>,
  targetAddresses?: string[]
): { provider: ethers.providers.WebSocketProvider; stop: () => void } {
  try {
    // Using WebSocketProvider directly from ethers
    const wsProvider = new ethers.providers.WebSocketProvider(
      wsRpcUrl
    );
    
    enhancedLogger.info('Starting mempool listener', {
      category: 'system',
      source: 'mempool'
    });
    
    // Setup subscription to pending transactions
    wsProvider.on('pending', async (txHash) => {
      try {
        // Don't fetch full tx details if we don't need to (optimization)
        if (targetAddresses && targetAddresses.length > 0) {
          const txReceipt = await wsProvider.getTransaction(txHash);
          
          // Skip if transaction doesn't exist or doesn't match our target addresses
          if (!txReceipt || !txReceipt.to) return;
          
          const toAddress = txReceipt.to.toLowerCase();
          const isTargetAddress = targetAddresses.some(addr => 
            addr.toLowerCase() === toAddress
          );
          
          if (!isTargetAddress) return;
          
          // Process the transaction with callback
          await onTransaction(txReceipt);
        } else {
          // Get full transaction details
          const txReceipt = await wsProvider.getTransaction(txHash);
          if (!txReceipt) return;
          
          // Process the transaction with callback
          await onTransaction(txReceipt);
        }
      } catch (err) {
        enhancedLogger.error(`Error processing pending transaction: ${err instanceof Error ? err.message : 'Unknown error'}`, {
          category: 'error',
          source: 'mempool',
          data: err
        });
      }
    });

    // Log connection events
    wsProvider._websocket.on('open', () => {
      enhancedLogger.info('WebSocket connected to mempool', {
        category: 'system',
        source: 'mempool'
      });
    });

    wsProvider._websocket.on('close', (code: number, reason: string) => {
      enhancedLogger.warn(`WebSocket disconnected from mempool: ${code} - ${reason}`, {
        category: 'system',
        source: 'mempool'
      });
    });

    wsProvider._websocket.on('error', (error: Error) => {
      enhancedLogger.error(`WebSocket error: ${error.message}`, {
        category: 'error',
        source: 'mempool',
        data: error
      });
    });
    
    // Return the provider instance and a function to stop listening
    return {
      provider: wsProvider,
      stop: () => {
        try {
          wsProvider.removeAllListeners();
          wsProvider._websocket.close();
          enhancedLogger.info('WebSocket disconnected and listeners removed', {
            category: 'system',
            source: 'mempool'
          });
        } catch (err) {
          enhancedLogger.error(`Error stopping WebSocket: ${err instanceof Error ? err.message : 'Unknown error'}`, {
            category: 'error',
            source: 'mempool',
            data: err
          });
        }
      }
    };
  } catch (err) {
    enhancedLogger.error(`Failed to setup mempool listener: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      category: 'error',
      source: 'mempool',
      data: err
    });
    throw err;
  }
}

/**
 * Fetch a batch of pending transactions from the mempool
 * @param limit Maximum number of transactions to return
 * @param provider Ethers provider to use
 * @returns Array of pending transactions
 */
export async function getPendingTransactions(
  limit = 50,
  provider?: ethers.providers.WebSocketProvider
): Promise<ethers.providers.TransactionResponse[]> {
  const wsProvider = provider || new ethers.providers.WebSocketProvider(wsRpcUrl);
  const txs: ethers.providers.TransactionResponse[] = [];

  return new Promise((resolve, reject) => {
    // Set a timeout to prevent hanging indefinitely
    const timeout = setTimeout(() => {
      wsProvider.removeAllListeners('pending');
      if (wsProvider._websocket && wsProvider._websocket.readyState === WebSocket.OPEN) {
        wsProvider._websocket.close();
      }
      resolve(txs);
    }, 10000); // 10 second timeout

    wsProvider.on('pending', async (txHash) => {
      try {
        const tx = await wsProvider.getTransaction(txHash);
        if (tx && tx.to) {
          txs.push(tx);
        }

        if (txs.length >= limit) {
          clearTimeout(timeout);
          wsProvider.removeAllListeners('pending');
          if (wsProvider._websocket && wsProvider._websocket.readyState === WebSocket.OPEN) {
            wsProvider._websocket.close();
          }
          resolve(txs);
        }
      } catch (e) {
        // Ignore errors silently for individual transactions
      }
    });

    // If WebSocket errors out
    wsProvider._websocket.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
