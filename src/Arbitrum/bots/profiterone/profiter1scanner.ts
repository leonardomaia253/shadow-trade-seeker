import { ethers, BigNumber } from "ethers";
import pLimit from "p-limit";
import { QuoteResult, TokenInfo } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { estimateSwapOutput } from "../../utils/estimateOutput";

export type EstimateSwapOutputResult = {
  output: BigNumber;
  paths: string[];
  dex: string;
};

const DEX_LIST_PRIORITY = [
  "uniswapv3",
  "uniswapv2",
  "uniswapv4",
  "sushiswapv3",
  "sushiswapv2",
  "camelot",
  "maverickv2",
  "ramsesv2",
  "pancakeswapv3",
  "curve",
];

const MIN_PROFIT_THRESHOLD = 0.01; // em unidades do token base
const MAX_CONCURRENT_CALLS = 10;
const SLIPPAGE_TOLERANCE = 0.005; // 0.5%

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
  const limit = pLimit(MAX_CONCURRENT_CALLS);

  const quotePromises = DEX_LIST_PRIORITY.map((dex) =>
    limit(() => getQuoteFromDex(params.tokenIn, params.tokenOut, params.amountIn, dex))
  );

  const quotes = await Promise.all(quotePromises);
  const validQuotes = quotes.filter((q): q is EstimateSwapOutputResult => q !== null);

  if (validQuotes.length === 0) return null;

  // Retorna o melhor quote
  return validQuotes.reduce((best, current) =>
    current.output.gt(best.output) ? current : best
  );
}

export async function findBestArbitrageRoute({
  provider,
  baseToken,
  tokenList,
  amountInRaw = "1",
}: {
  provider: ethers.providers.Provider;
  baseToken: TokenInfo;
  tokenList: TokenInfo[];
  amountInRaw?: string; // valor em unidades do token base, ex: "1"
}) {
  const BATCH_SIZE = 20;
  const amountIn = ethers.utils.parseUnits(amountInRaw, baseToken.decimals);

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

          // base → intermediate
          const firstHopQuote = await getBestQuoteAcrossDEXs({
            tokenIn: baseToken.address,
            tokenOut: intermediate.address,
            amountIn,
          });

          if (!firstHopQuote) return null;

          // intermediate → base
          const secondHopQuote = await getBestQuoteAcrossDEXs({
            tokenIn: intermediate.address,
            tokenOut: baseToken.address,
            amountIn: firstHopQuote.output,
          });

          if (!secondHopQuote) return null;

          const finalAmountOut = secondHopQuote.output;
          if (finalAmountOut.lte(amountIn)) return null;

          const gasEstimate = await estimateGasUsage([
            baseToken.address,
            intermediate.address,
            baseToken.address,
          ]);

          const gasCost = await getGasCostInToken({
            provider,
            token: baseToken,
            gasUnits: gasEstimate,
          });

          const profit = finalAmountOut.sub(amountIn);
          const netProfit = profit.sub(gasCost);

          const netProfitReadable = ethers.utils.formatUnits(netProfit, baseToken.decimals);
          const grossProfitReadable = ethers.utils.formatUnits(profit, baseToken.decimals);
          console.log(`[${baseToken.symbol}→${intermediate.symbol}→${baseToken.symbol}] | ${firstHopQuote.dex}→${secondHopQuote.dex} | Gross: ${grossProfitReadable} | Net: ${netProfitReadable}`);

          if (
            netProfit.gt(maxNetProfit) &&
            netProfit.gt(ethers.utils.parseUnits(MIN_PROFIT_THRESHOLD.toString(), baseToken.decimals))
          ) {
            const amountOutMin = finalAmountOut
              .mul(10000 - Math.floor(SLIPPAGE_TOLERANCE * 10000))
              .div(10000);

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
              },
            ];

            const combinedQuote: QuoteResult = {
              amountIn: BigInt(amountIn.toString()),
              amountOut: BigInt(finalAmountOut.toString()),
              amountOutMin: BigInt(amountOutMin.toString()),
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
