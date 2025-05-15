
// bots/arbitrage/arbitrageScanner.ts
import { ethers } from "ethers";
import { QuoteResult, TokenInfo } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";

const MIN_PROFIT_THRESHOLD = 1; // em token base (ex: 0.001 WETH)

async function getDexQuote({
  provider,
  path,
  amountIn,
}: {
  provider: ethers.providers.Provider;
  path: TokenInfo[];
  amountIn: ethers.BigNumber;
}): Promise<QuoteResult | null> {
  if (path.length < 2) return null;
  
  const tokenIn = path[0];
  const tokenOut = path[1];
  
  try {
    // Convert BigNumber to string for compatibility
    const amountInStr = amountIn.toString();
    
    // Get quotes from various DEXs
    const quotesResult = await getQuote(
      provider,
      "uniswapv3", // default dex
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountInStr
      }
    );
    
    // If no paths found, return null
    if (!quotesResult || !quotesResult.paths || !quotesResult.paths.length) return null;
    
    // Get the best quote (first one, as they're sorted by output)
    const bestQuote = quotesResult.paths[0];
    
    return {
      amountIn: BigInt(amountInStr),
      amountOut: bestQuote.output,
      amountOutMin: BigInt(0), // Add missing property
      estimatedGas: ethers.BigNumber.from(200000), // Add missing property
      path: path,
      dex: bestQuote.source
    };
  } catch (error) {
    console.error("Error fetching DEX quotes:", error);
    return null;
  }
}

export async function findBestArbitrageRoute({
  provider,
  baseToken,
  tokenList,
}: {
  provider: ethers.providers.Provider;
  baseToken: TokenInfo;
  tokenList: TokenInfo[];
}) {
  let bestRoute = null;
  let maxNetProfit = ethers.BigNumber.from(0);

  for (const intermediate of tokenList) {
    if (intermediate.address === baseToken.address) continue;

    const path = [baseToken, intermediate, baseToken];
    const amountIn = ethers.utils.parseUnits("1", baseToken.decimals);
    const amountInBigInt = BigInt(amountIn.toString());

    // First hop: base -> intermediate
    const firstHopQuote = await getQuote(
      provider,
      "uniswapv3",
      { 
        tokenIn: baseToken.address, 
        tokenOut: intermediate.address, 
        amountIn: amountIn.toString()
      }
    );
    
    if (!firstHopQuote || !firstHopQuote.output) continue;

    // Second hop: intermediate -> base
    const secondHopQuote = await getQuote(
      provider,
      "uniswapv3",
      {
        tokenIn: intermediate.address,
        tokenOut: baseToken.address,
        amountIn: firstHopQuote.output.toString()
      }
    );
    
    if (!secondHopQuote || !secondHopQuote.output) continue;

    const finalAmountOut = secondHopQuote.output;
    const gasEstimate = await estimateGasUsage(path);
    const gasCost = await getGasCostInToken({
      provider,
      token: baseToken,
      gasUnits: gasEstimate,
    });

    const profit = ethers.BigNumber.from(finalAmountOut.toString()).sub(amountIn);
    const netProfit = profit.sub(gasCost);

    // Add missing properties required by QuoteResult
    const combinedQuote = {
      amountIn: amountInBigInt,
      amountOut: finalAmountOut,
      amountOutMin: BigInt(0), // Add missing property
      estimatedGas: ethers.BigNumber.from(200000), // Add missing property
      path: path,
      dex: `${firstHopQuote.source}→${secondHopQuote.source}`,
    };

    if (
      netProfit.gt(maxNetProfit) &&
      netProfit.gt(ethers.utils.parseUnits(MIN_PROFIT_THRESHOLD.toString(), baseToken.decimals))
    ) {
      maxNetProfit = netProfit;
      bestRoute = {
        path,
        quote: combinedQuote,
        gasCost: BigInt(gasCost.toString()),
        netProfit: BigInt(netProfit.toString()),
      };
    }
  }

  return bestRoute;
}
