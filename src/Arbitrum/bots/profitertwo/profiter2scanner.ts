
import { ethers, BigNumber } from "ethers";
import pLimit from "p-limit";
import { TokenInfo, QuoteResult } from "../../utils/types";
import { getGasCostInToken, estimateGasUsage } from "../../utils/gasEstimator";
import { estimateSwapOutput } from "../../utils/estimateOutput";
import { LRUCache } from "lru-cache";

// Lista de DEXs ordenada por prioridade/eficiência
const DEX_LIST_PRIORITY = [
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
const MAX_HOPS = 3;                 // Limitado para evitar rotas muito complexas
const MAX_CONCURRENT_CALLS = 8;     // Limita chamadas paralelas
const SLIPPAGE = 0.005;             // 0.5% de slippage
const MIN_PROFIT = 0.01;            // Lucro mínimo em ETH
const CACHE_TTL = 30 * 1000;        // 30 segundos de TTL para cache

// Cache para resultados de quotes
const quoteCache = new LRUCache<string, {
  timestamp: number;
  result: { dex: string; amountOut: BigNumber } | null;
}>({
  max: 1000,  // Máximo de 1000 entradas no cache
  ttl: CACHE_TTL
});

// Limita chamadas concorrentes
const limit = pLimit(MAX_CONCURRENT_CALLS);

// Tipo para representar um passo na rota
type Path = {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  dex: string;
  amountIn: BigNumber;
  amountOut: BigNumber;
  liquidity?: BigNumber;    // Adicionado campo para armazenar liquidez
};

/**
 * Obtém a melhor cotação para um swap entre dois tokens
 * Usa cache para evitar chamadas repetidas recentes
 */
async function getBestQuote(
  from: TokenInfo,
  to: TokenInfo,
  amountIn: BigNumber
): Promise<{ dex: string; amountOut: BigNumber; liquidity?: BigNumber } | null> {
  const cacheKey = `${from.address}-${to.address}-${amountIn.toString()}`;
  
  // Verifica se temos no cache e se ainda é válido
  const cached = quoteCache.get(cacheKey);
  if (cached) {
    return cached.result;
  }

  // Executa chamadas em paralelo para cada DEX
  const results = await Promise.all(
    DEX_LIST_PRIORITY.map((dex) =>
      limit(async () => {
        try {
          const out = await estimateSwapOutput(from.address, to.address, amountIn, dex);
          
          // Adicionamos uma estimativa básica de liquidez (exemplo simples)
          // Em uma implementação real, buscaríamos a liquidez real da pool
          const liquidity = out.mul(10); // Estimativa simples
          
          return out.gt(0) ? { dex, amountOut: out, liquidity } : null;
        } catch (error) {
          // Silenciosamente falha e retorna null
          return null;
        }
      })
    )
  );

  // Encontra o melhor resultado com base no amountOut
  const bestResult = results.reduce((best, cur) =>
    cur && (!best || cur.amountOut.gt(best.amountOut)) ? cur : best, null);
  
  // Armazena no cache
  quoteCache.set(cacheKey, { timestamp: Date.now(), result: bestResult });
  
  return bestResult;
}

/**
 * Implementação de algoritmo similar a Dijkstra para exploração de rotas
 * Busca as rotas mais lucrativas entre tokens
 */
async function explorePaths(
  current: TokenInfo,
  base: TokenInfo,
  tokens: TokenInfo[],
  visited: Set<string>,
  amountIn: BigNumber,
  depth: number,
  pathSoFar: Path[] = []
): Promise<{ path: Path[]; amountOut: BigNumber } | null> {
  // Verifica profundidade máxima
  if (depth > MAX_HOPS) return null;
  
  // Marca token atual como visitado
  visited.add(current.address);

  let bestResult: { path: Path[]; amountOut: BigNumber } | null = null;
  
  // Array para armazenar promessas de todas as consultas de swap
  const swapPromises = [];

  // Para cada token possível no próximo passo
  for (const nextToken of tokens) {
    // Pula tokens já visitados ou o próprio token atual
    if (visited.has(nextToken.address) || current.address === nextToken.address) continue;

    // Adiciona a promessa à lista
    swapPromises.push((async () => {
      // Obtém a melhor cotação para este par
      const quote = await getBestQuote(current, nextToken, amountIn);
      if (!quote || quote.amountOut.isZero()) return null;

      const hop: Path = {
        tokenIn: current,
        tokenOut: nextToken,
        dex: quote.dex,
        amountIn,
        amountOut: quote.amountOut,
        liquidity: quote.liquidity
      };

      // Se chegamos de volta ao token base, temos um ciclo completo
      if (nextToken.address === base.address) {
        return {
          path: [...pathSoFar, hop],
          amountOut: quote.amountOut,
        };
      } 
      // Caso contrário, continuamos a exploração (recursão)
      else {
        const subPath = await explorePaths(
          nextToken,
          base,
          tokens,
          new Set(visited),
          quote.amountOut,
          depth + 1,
          [...pathSoFar, hop]
        );

        return subPath;
      }
    })());
  }

  // Executa todas as promessas em paralelo
  const results = await Promise.all(swapPromises);
  
  // Filtra resultados nulos
  const validResults = results.filter((result): result is { path: Path[]; amountOut: BigNumber } => 
    result !== null
  );
  
  // Encontra o melhor resultado baseado no amountOut final
  bestResult = validResults.reduce(
    (best, current) => !best || current.amountOut.gt(best.amountOut) ? current : best,
    null as { path: Path[]; amountOut: BigNumber } | null
  );

  return bestResult;
}

/**
 * Encontra a melhor rota de arbitragem multi-hop
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
  // Converte o valor de entrada para BigNumber com as casas decimais corretas
  const amountIn = ethers.utils.parseUnits(amountInRaw, baseToken.decimals);
  
  // Selecionamos tokens mais prováveis para rotas lucrativas
  // Filtramos para os N tokens mais líquidos (poderia ser baseado em dados externos)
  const filteredTokens = tokenList.slice(0, 20); 
  
  let bestPath: Path[] = [];
  let bestAmountOut = BigNumber.from(0);
  let bestGas = BigNumber.from(0);
  let bestNetProfit = BigNumber.from(0);

  // Busca as melhores rotas começando do token base
  const pathResult = await explorePaths(
    baseToken,
    baseToken,
    filteredTokens,
    new Set(),
    amountIn,
    1
  );

  if (pathResult && pathResult.amountOut.gt(amountIn)) {
    const totalPath = pathResult.path.map((p) => p.tokenIn);
    totalPath.push(pathResult.path[pathResult.path.length - 1].tokenOut);
    
    // Estima gasto de gas
    const gasUsed = await estimateGasUsage(totalPath.map((t) => t.address));
    const gasCost = await getGasCostInToken({
      provider,
      token: baseToken,
      gasUnits: gasUsed,
    });

    // Calcula lucro bruto e líquido
    const profit = pathResult.amountOut.sub(amountIn);
    const netProfit = profit.sub(gasCost);

    console.log(
      `[Rota: ${totalPath.map((t) => t.symbol).join(" → ")}] Bruto: ${ethers.utils.formatUnits(profit, baseToken.decimals)} | Líquido: ${ethers.utils.formatUnits(netProfit, baseToken.decimals)}`
    );

    // Verifica se o lucro líquido é maior que o mínimo definido
    if (netProfit.gt(ethers.utils.parseUnits(MIN_PROFIT.toString(), baseToken.decimals))) {
      bestPath = pathResult.path;
      bestAmountOut = pathResult.amountOut;
      bestGas = BigNumber.from(gasCost);
      bestNetProfit = netProfit;
    }
  }

  // Se não encontrou rota lucrativa
  if (bestPath.length === 0) return null;

  // Calcula valor mínimo esperado considerando slippage
  const amountOutMin = bestAmountOut
    .mul(10000 - Math.round(SLIPPAGE * 10000))
    .div(10000)
    .toBigInt();

  // Prepara o resultado
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
