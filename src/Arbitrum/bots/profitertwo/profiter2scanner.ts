import { ethers, BigNumber } from "ethers";
import pLimit from "p-limit";
import { TokenInfo, QuoteResult } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { estimateSwapOutput } from "../../utils/estimateOutput";

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

const MAX_HOPS = 10;
const MAX_CONCURRENT_CALLS = 8;
const SLIPPAGE = 0.005;
const MIN_PROFIT = 0.01;

const limit = pLimit(MAX_CONCURRENT_CALLS);

type Path = {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  dex: string;
  amountIn: BigNumber;
  amountOut: BigNumber;
};

async function getBestQuote(
  from: TokenInfo,
  to: TokenInfo,
  amountIn: BigNumber
): Promise<{ dex: string; amountOut: BigNumber } | null> {
  const results = await Promise.all(
    DEX_LIST_PRIORITY.map((dex) =>
      limit(async () => {
        try {
          const out = await estimateSwapOutput(from.address, to.address, amountIn, dex);
          return out.gt(0) ? { dex, amountOut: out } : null;
        } catch {
          return null;
        }
      })
    )
  );

  return results.reduce((best, cur) =>
    cur && (!best || cur.amountOut.gt(best.amountOut)) ? cur : best
  , null);
}

async function explorePaths(
  current: TokenInfo,
  base: TokenInfo,
  tokens: TokenInfo[],
  visited: Set<string>,
  amountIn: BigNumber,
  depth: number
): Promise<{ path: Path[]; amountOut: BigNumber } | null> {
  if (depth > MAX_HOPS) return null;
  visited.add(current.address);

  let bestResult: { path: Path[]; amountOut: BigNumber } | null = null;

  for (const nextToken of tokens) {
    if (visited.has(nextToken.address) || current.address === nextToken.address) continue;

    const quote = await getBestQuote(current, nextToken, amountIn);
    if (!quote || quote.amountOut.isZero()) continue;

    const hop: Path = {
      tokenIn: current,
      tokenOut: nextToken,
      dex: quote.dex,
      amountIn,
      amountOut: quote.amountOut,
    };

    // Recurse
    if (nextToken.address === base.address) {
      // Final hop
      const result = {
        path: [hop],
        amountOut: quote.amountOut,
      };
      if (
        !bestResult ||
        result.amountOut.gt(bestResult.amountOut)
      ) {
        bestResult = result;
      }
    } else {
      const subPath = await explorePaths(
        nextToken,
        base,
        tokens,
        new Set(visited),
        quote.amountOut,
        depth + 1
      );
      if (subPath) {
        const totalPath = [hop, ...subPath.path];
        const totalOut = subPath.amountOut;
        if (!bestResult || totalOut.gt(bestResult.amountOut)) {
          bestResult = {
            path: totalPath,
            amountOut: totalOut,
          };
        }
      }
    }
  }

  return bestResult;
}

export async function findBestMultiHopRoute({
  provider,
  baseToken,
  tokenList,
  amountInRaw = "1",
}: {
  provider: ethers.providers.Provider;
  baseToken: TokenInfo;
  tokenList: TokenInfo[];
  amountInRaw?: string;
}) {
  const amountIn = ethers.utils.parseUnits(amountInRaw, baseToken.decimals);
  const visited = new Set<string>();
  let bestPath: Path[] = [];
  let bestAmountOut = BigNumber.from(0);
  let bestGas = BigNumber.from(0);
  let bestNetProfit = BigNumber.from(0);

  const results = await Promise.all(
    tokenList.map(async (token) => {
      if (token.address === baseToken.address) return null;

      const pathResult = await explorePaths(
        baseToken,
        baseToken,
        tokenList,
        new Set(),
        amountIn,
        1
      );

      if (!pathResult || pathResult.amountOut.lte(amountIn)) return null;

      const totalPath = [baseToken, ...pathResult.path.map((p) => p.tokenIn)];
      const gasUsed = await estimateGasUsage(totalPath.map((t) => t.address));
      const gasCost = await getGasCostInToken({
        provider,
        token: baseToken,
        gasUnits: gasUsed,
      });

      const profit = pathResult.amountOut.sub(amountIn);
      const netProfit = profit.sub(gasCost);

      console.log(
        `[Route: ${totalPath.map((t) => t.symbol).join(" → ")}] Gross: ${ethers.utils.formatUnits(profit, baseToken.decimals)} | Net: ${ethers.utils.formatUnits(netProfit, baseToken.decimals)}`
      );

      if (
        netProfit.gt(bestNetProfit) &&
        netProfit.gt(ethers.utils.parseUnits(MIN_PROFIT.toString(), baseToken.decimals))
      ) {
        bestPath = pathResult.path;
        bestAmountOut = pathResult.amountOut;
        bestGas = BigNumber.from(gasCost);
        bestNetProfit = netProfit;
      }

      return null;
    })
  );

  if (bestPath.length === 0) return null;

  const amountOutMin = bestAmountOut
    .mul(10000 - SLIPPAGE * 10000)
    .div(10000)
    .toBigInt();

  const quote: QuoteResult = {
    amountIn: amountIn.toBigInt(),
    amountOut: bestAmountOut.toBigInt(),
    amountOutMin,
    estimatedGas: bestGas.toBigInt(),
    path: [baseToken, ...bestPath.map((p) => p.tokenIn)],
    dex: bestPath.map((p) => p.dex).join("→"),
  };

  return {
    route: bestPath,
    quote,
    gasCost: bestGas.toBigInt(),
    netProfit: bestNetProfit.toBigInt(),
    inputAmount: amountIn,
  };
}
