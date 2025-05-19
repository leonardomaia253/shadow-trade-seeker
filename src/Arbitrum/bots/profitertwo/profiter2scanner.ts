import { ethers, BigNumber } from "ethers";
import pLimit from "p-limit";
import { TokenInfo, QuoteResult } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { estimateSwapOutput } from "../../shared/utils/QuoteRouter";
import { LRUCache } from "lru-cache";

// Prioridade dos DEXs para consulta
const DEX_PRIORITY = [
  "uniswapv3",
  "uniswapv2",
  "sushiswapv3",
  "sushiswapv2",
  "camelot",
  "pancakeswapv3",
  "maverickv2",
  "ramsesv2",
  "uniswapv4",
  "curve",
];

// Configurações
const MAX_HOPS = 3;
const MAX_CONCURRENT_CALLS = 8;
const SLIPPAGE = 0.005;  // 0.5%
const MIN_PROFIT = 0.01; // em ETH
const CACHE_TTL_MS = 30_000;



// Cache LRU para quotes
const quoteCache = new LRUCache<string, { timestamp: number; result: QuoteCacheResult | null }>({
  max: 1000,
  ttl: CACHE_TTL_MS,
});

const limit = pLimit(MAX_CONCURRENT_CALLS);

type QuoteCacheResult = { dex: string; amountOut: BigNumber; liquidity: BigNumber };

type PathStep = {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  dex: string;
  amountIn: BigNumber;
  amountOut: BigNumber;
  liquidity?: BigNumber;
};

/**
 * Obtém a melhor cotação entre dois tokens usando múltiplos DEXs,
 * com cache para otimização.
 */
async function getBestQuote(
  from: TokenInfo,
  to: TokenInfo,
  amountIn: BigNumber
): Promise<QuoteCacheResult | null> {
  const cacheKey = `${from.address}-${to.address}-${amountIn.toString()}`;
  const cached = quoteCache.get(cacheKey);
  if (cached) return cached.result;

  const quotePromises = DEX_PRIORITY.map((dex) =>
    limit(async () => {
      try {
        const amountOut = await estimateSwapOutput(from.address, to.address, amountIn, dex);
        if (amountOut.lte(0)) return null;
        // Simulação simples de liquidez: amountOut * 10 (exemplo)
        return { dex, amountOut, liquidity: amountOut.mul(10) };
      } catch {
        return null;
      }
    })
  );

  const quotes = (await Promise.all(quotePromises)).filter(
    (q): q is QuoteCacheResult => q !== null
  );

  if (quotes.length === 0) {
    quoteCache.set(cacheKey, { timestamp: Date.now(), result: null });
    return null;
  }

  // Ordena para pegar o melhor output
  quotes.sort((a, b) => b.amountOut.sub(a.amountOut).toNumber());
  const bestQuote = quotes[0];

  quoteCache.set(cacheKey, { timestamp: Date.now(), result: bestQuote });
  return bestQuote;
}

/**
 * Explora recursivamente rotas multi-hop para encontrar a mais lucrativa.
 */
type ExploreResult = {
  path: PathStep[];
  amountOut: BigNumber;
};

async function explorePaths(
  from: TokenInfo,
  to: TokenInfo,
  tokens: TokenInfo[],
  visited: Set<string>,
  amountIn: BigNumber,
  hop: number
): Promise<ExploreResult | null> {
  if (hop > MAX_HOPS) return null;
  if (from.address === to.address) return null;

  // Marca o token atual como visitado para evitar ciclos
  visited.add(from.address);

  // Tenta a troca direta
  const directQuote = await getBestQuote(from, to, amountIn);

  let bestResult: ExploreResult | null = null;

  if (directQuote && directQuote.amountOut.gt(0)) {
    bestResult = {
      path: [{
        tokenIn: from,
        tokenOut: to,
        dex: directQuote.dex,
        amountIn,
        amountOut: directQuote.amountOut,
        liquidity: directQuote.liquidity,
      }],
      amountOut: directQuote.amountOut,
    };
  }

  // Tenta multi-hop pelos tokens restantes (menos os visitados)
  for (const intermediate of tokens) {
    if (visited.has(intermediate.address)) continue;
    if (intermediate.address === to.address) continue;

    // Cotação do primeiro salto
    const firstLeg = await getBestQuote(from, intermediate, amountIn);

    if (!firstLeg || firstLeg.amountOut.lte(0)) continue;

    // Recursão para o próximo salto com o output do primeiro
    const nextLeg = await explorePaths(
      intermediate,
      to,
      tokens,
      new Set(visited), // Passa cópia para evitar alteração fora do escopo
      firstLeg.amountOut,
      hop + 1
    );

    if (!nextLeg) continue;

    const totalAmountOut = nextLeg.amountOut;
    if (totalAmountOut.lte(0)) continue;

    // Combina a rota
    const candidatePath = [
      {
        tokenIn: from,
        tokenOut: intermediate,
        dex: firstLeg.dex,
        amountIn,
        amountOut: firstLeg.amountOut,
        liquidity: firstLeg.liquidity,
      },
      ...nextLeg.path,
    ];

    // Se a nova rota é melhor, atualiza
    if (!bestResult || totalAmountOut.gt(bestResult.amountOut)) {
      bestResult = {
        path: candidatePath,
        amountOut: totalAmountOut,
      };
    }
  }

  return bestResult;
}


/**
 * Encontra a melhor rota multi-hop de arbitragem a partir de um token base.
 */
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

  // Filtra tokens (top 20) para reduzir complexidade
  const filteredTokens = tokenList.slice(0, 20);

  const routeResult = await explorePaths(baseToken, baseToken, filteredTokens, new Set(), amountIn, 1);

  if (!routeResult || routeResult.amountOut.lte(amountIn)) return null;

  // Monta lista de tokens no caminho (evita duplicação)
  const routeTokens = routeResult.path.map((step) => step.tokenIn);
  routeTokens.push(routeResult.path[routeResult.path.length - 1].tokenOut);

  const gasUsed = await estimateGasUsage(routeTokens.map((t) => t.address));
  const gasCost = await getGasCostInToken({ provider, token: baseToken, gasUnits: gasUsed });

  const grossProfit = routeResult.amountOut.sub(amountIn);
  const netProfit = grossProfit.sub(gasCost);

  console.log(
    `[Rota: ${routeTokens.map((t) => t.symbol).join(" → ")}] Bruto: ${ethers.utils.formatUnits(grossProfit, baseToken.decimals)} | Líquido: ${ethers.utils.formatUnits(netProfit, baseToken.decimals)}`
  );

  if (netProfit.lte(ethers.utils.parseUnits(MIN_PROFIT.toString(), baseToken.decimals))) return null;

  const amountOutMin = routeResult.amountOut
    .mul(10000 - Math.round(SLIPPAGE * 10000))
    .div(10000)
    .toBigInt();

  const quote: QuoteResult = {
    amountIn: amountIn.toBigInt(),
    amountOut: routeResult.amountOut.toBigInt(),
    amountOutMin,
    estimatedGas: gasUsed.toBigInt(),
    path: routeTokens,
    dex: routeResult.path.map((step) => step.dex).join("→"),
  };

  return {
    route: routeResult.path,
    quote,
    gasCost: gasCost.toBigInt(),
    netProfit: netProfit.toBigInt(),
    inputAmount: amountIn,
  };
}
