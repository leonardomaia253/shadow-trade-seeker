
// bots/arbitrage/arbitrageScanner.ts
import { ethers } from "ethers";
import { QuoteResult, TokenInfo } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { getQuote } from "../../shared/build/getQuote";

const MIN_PROFIT_THRESHOLD = 1; // em token base (ex: 0.001 WETH)

async function getDexQuote({
  path,
  amountIn,
}: {
  path: TokenInfo[];
  amountIn: ethers.BigNumber;
}): Promise<QuoteResult | null> {
  if (path.length < 2) return null;
  
  const tokenIn = path[0];
  const tokenOut = path[1];
  
  try {
    // Convert BigNumber to bigint for getDexQuotes
    
    const amountInBigInt = BigInt(amountIn.toString());
    
    // Get quotes from various DEXs
    const quotesResult = await getQuote(
      tokenIn.address,
      tokenOut.address,
      amountInBigInt
    );
    
    // If no paths found, return null
    if (!quotesResult.paths.length) return null;
    
    // Get the best quote (first one, as they're sorted by output)
    const bestQuote = quotesResult.paths[0];
    
    return {
      amountIn: amountInBigInt,
      amountOut: bestQuote.output,
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
    const firstHopQuote = await await getQuote({tokenIn,tokenOut,amountIn: amountInBigInt});
    if (!firstHopQuote || firstHopQuote.output === 0n) continue;

    // Second hop: intermediate -> base
    const secondHopQuote = await getQuote(intermediate.address, baseToken.address, firstHopQuote.output);
    if (!secondHopQuote || secondHopQuote.output === 0n) continue;

    const finalAmountOut = secondHopQuote.output;
    const gasEstimate = await estimateGasUsage(path);
    const gasCost = await getGasCostInToken({
      provider,
      token: baseToken,
      gasUnits: gasEstimate,
    });

    const profit = ethers.BigNumber.from(finalAmountOut.toString()).sub(amountIn);
    const netProfit = profit.sub(gasCost);

    const combinedQuote: QuoteResult = {
      amountIn: amountInBigInt,
      amountOut: finalAmountOut,
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
