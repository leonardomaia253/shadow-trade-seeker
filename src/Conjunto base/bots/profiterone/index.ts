import { ethers } from 'ethers';
import { enhancedLogger } from '../../utils/enhancedLogger';
import { buildArbRoutes } from './arbitragebuilder';
import { executeArbitrage } from './executor';
import { WETH, USDC, USDT, DAI, WBTC, ARB } from '../../constants/tokens';

// Token pairs to monitor for arbitrage opportunities
const DEFAULT_TOKEN_PAIRS = [
  [WETH, USDC],
  [WETH, USDT],
  [WETH, DAI],
  [WETH, WBTC],
  [WETH, ARB],
  [USDC, USDT],
  [USDC, DAI],
  [WBTC, USDC]
];

/**
 * Main arbitrage bot logic
 */
export async function runArbitrageBot(
  provider: ethers.providers.WebSocketProvider,
  wallet: ethers.Wallet
): Promise<void> {
  enhancedLogger.info(`Arbitrage bot started on Arbitrum`);

  // Continuously monitor for arbitrage opportunities
  while (true) {
    try {
      // Loop through token pairs
      for (const [tokenA, tokenB] of DEFAULT_TOKEN_PAIRS) {
        // Build the arbitrage route
        const route = await buildArbRoutes(tokenA, tokenB);

        if (route) {
          enhancedLogger.info(`Arbitrage opportunity found`, {
            tokenA,
            tokenB,
            profit: route.profitUSD,
          });

          // Execute the arbitrage
          await executeArbitrage(route, wallet);
        } else {
          enhancedLogger.debug(`No arbitrage opportunity found for ${tokenA}-${tokenB}`);
        }
      }
    } catch (error: any) {
      enhancedLogger.error(`Error in arbitrage bot: ${error instanceof Error ? error.message : String(error)}`, {
        error,
      });
    }

    // Wait before next iteration
    await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds
  }
}
