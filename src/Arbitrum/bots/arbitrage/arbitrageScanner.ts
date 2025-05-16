import { ethers, BigNumber } from "ethers";
import { QuoteResult, TokenInfo } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { estimateSwapOutput } from "../../utils/estimateOutput";

export type EstimateSwapOutputResult = {
  output: BigNumber;
  paths: string[];
  dex: string;
};

const DEX_LIST = [
  "uniswapv3",
  "uniswapv2",
  "uniswapv4",
  "sushiswapv2",
  "sushiswapv3",
  "camelot",
  "maverickv2",
  "ramsesv2",
  "pancakeswapv3",
  "curve",
];

const MIN_PROFIT_THRESHOLD = 1; // 1 unidade do token base

async function getQuoteFromDex(
  fromToken: string,
  toToken: string,
  amountIn: BigNumber,
  dex: string
): Promise<EstimateSwapOutputResult | null> {
  try {
    const output = await estimateSwapOutput(fromToken, toToken, amountIn, dex);
    if (output.isZero()) return null;

    return {
      output,
      paths: [fromToken, toToken],
      dex,
    };
  } catch {
    return null;
  }
}

async function getBestQuoteAcrossDEXs(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
}): Promise<EstimateSwapOutputResult | null> {
  const quotePromises = DEX_LIST.map((dex) =>
    getQuoteFromDex(params.tokenIn, params.tokenOut, params.amountIn, dex)
  );

  const quotes = await Promise.all(quotePromises);
  const validQuotes = quotes.filter((q): q is EstimateSwapOutputResult => q !== null);

  if (validQuotes.length === 0) return null;

  // Escolher o melhor output
  return validQuotes.reduce((best, current) =>
    current.output.gt(best.output) ? current : best
  );
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
  const BATCH_SIZE = 20;

  let bestRoute: {
    route: {
      tokenIn: TokenInfo;
      tokenOut: TokenInfo;
      dex: string;
      amountIn: ethers.BigNumber;
      amountOut: ethers.BigNumber;
    }[];
    quote: QuoteResult;
    gasCost: bigint;
    netProfit: bigint;
    inputAmount: ethers.BigNumber;
  } | null = null;

  let maxNetProfit = ethers.BigNumber.from(0);

  for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
    const batch = tokenList.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (intermediate) => {
        try {
          if (intermediate.address === baseToken.address) return null;

          const amountIn = ethers.utils.parseUnits("1", baseToken.decimals);

          // Primeiro swap: base → intermediate
          const firstHopQuote = await getBestQuoteAcrossDEXs({
            tokenIn: baseToken.address,
            tokenOut: intermediate.address,
            amountIn,
          });

          if (!firstHopQuote) return null;

          // Segundo swap: intermediate → base
          const secondHopQuote = await getBestQuoteAcrossDEXs({
            tokenIn: intermediate.address,
            tokenOut: baseToken.address,
            amountIn: firstHopQuote.output,
          });

          if (!secondHopQuote) return null;

          const finalAmountOut = secondHopQuote.output;

          // Estimativa de gas
          const gasEstimate = await estimateGasUsage([baseToken.address, intermediate.address, baseToken.address]);
          const gasCost = await getGasCostInToken({
            provider,
            token: baseToken,
            gasUnits: gasEstimate,
          });

          const profit = finalAmountOut.sub(amountIn);
          const netProfit = profit.sub(gasCost);

          if (
            netProfit.gt(maxNetProfit) &&
            netProfit.gt(ethers.utils.parseUnits(MIN_PROFIT_THRESHOLD.toString(), baseToken.decimals))
          ) {
            // Monta o array de steps no formato esperado
            const route = [
              {
                tokenIn: baseToken,
                tokenOut: intermediate,
                dex: firstHopQuote.dex,
                amountIn,
                amountOut: firstHopQuote.output,
              },
              {
                tokenIn: intermediate,
                tokenOut: baseToken,
                dex: secondHopQuote.dex,
                amountIn: firstHopQuote.output,
                amountOut: finalAmountOut,
              }
            ];

            const combinedQuote: QuoteResult = {
              amountIn: BigInt(amountIn.toString()),
              amountOut: BigInt(finalAmountOut.toString()),
              amountOutMin: BigInt(0),
              estimatedGas: gasEstimate,
              path: [baseToken, intermediate, baseToken],
              dex: `${firstHopQuote.dex}→${secondHopQuote.dex}`,
            };

            return {
              route,
              quote: combinedQuote,
              gasCost: BigInt(gasCost.toString()),
              netProfit: BigInt(netProfit.toString()),
              inputAmount: amountIn,
            };
          }
          return null;
        } catch (e) {
          console.warn(`Erro ao processar token ${intermediate.symbol}:`, e);
          return null;
        }
      })
    );

    for (const candidate of batchResults) {
      if (candidate && ethers.BigNumber.from(candidate.netProfit.toString()).gt(maxNetProfit)) {
        maxNetProfit = ethers.BigNumber.from(candidate.netProfit.toString());
        bestRoute = candidate;
      }
    }
  }

  return bestRoute;
}
