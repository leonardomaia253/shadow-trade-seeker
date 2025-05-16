import { ethers } from "ethers";
import { enhancedLogger } from "./enhancedLogger";
import { DexType, LogMetadata } from "./types";
import { decodeSwap } from "./decodeSwap";
import { getTokenPrice } from "./getTokenPrice";
import { ERC20_ABI } from "../constants/abis";
import { TOKEN_DETAILS } from "../constants/tokens";

// Token reserves cache para cálculos rápidos de impacto
type ReservesCache = {
  [pairAddress: string]: {
    token0: string;
    token1: string;
    reserve0: ethers.BigNumber;
    reserve1: ethers.BigNumber;
    lastUpdate: number;
    decimals0: number;
    decimals1: number;
  }
};

// Cache para reservas de pares
const reservesCache: ReservesCache = {};
const CACHE_EXPIRY = 30 * 1000; // 30 segundos

/**
 * Busca detalhes do token (símbolo, decimais) da blockchain
 */
async function fetchTokenDetails(
  tokenAddress: string, 
  provider: ethers.providers.Provider
): Promise<{ symbol: string, decimals: number }> {
  // Verificar cache
  const tokenAddressLower = tokenAddress.toLowerCase();
  if (TOKEN_DETAILS[tokenAddressLower]) {
    return TOKEN_DETAILS[tokenAddressLower];
  }
  
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);
    
    enhancedLogger.debug(`Fetched token details for ${tokenAddress}: ${symbol}, ${decimals} decimals`, {
      category: "tokenDetails", 
      botType: "profitCalc"
    });
    
    return { symbol, decimals };
  } catch (err) {
    enhancedLogger.error(`Failed to fetch token details for ${tokenAddress}: ${err instanceof Error ? err.message : String(err)}`, {
      category: "tokenDetails", 
      botType: "profitCalc"
    });
    
    return { symbol: "UNKNOWN", decimals: 18 };
  }
}

/**
 * Busca as reservas de um par em uma DEX usando a interface apropriada
 */
async function fetchPairReserves(
  pairAddress: string, 
  token0: string,
  token1: string,
  provider: ethers.providers.Provider,
  dex: DexType
): Promise<{ reserve0: ethers.BigNumber, reserve1: ethers.BigNumber }> {
  // Verificar cache
  const now = Date.now();
  const cacheKey = `${pairAddress}-${dex}`;
  
  if (reservesCache[cacheKey] && (now - reservesCache[cacheKey].lastUpdate < CACHE_EXPIRY)) {
    enhancedLogger.debug(`Using cached reserves for ${pairAddress}`, { 
      category: "reserves", 
      botType: "profitCalc" 
    });
    return {
      reserve0: reservesCache[cacheKey].reserve0,
      reserve1: reservesCache[cacheKey].reserve1,
    };
  }
  
  try {
    // Definir ABI específico com base no DEX
    let pairAbi;
    
    if (dex === 'uniswapv2' || dex === 'sushiswapv2' || dex === 'camelot') {
      pairAbi = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
      ];
    } else if (dex === 'uniswapv3'|| dex === 'sushiswapv3' || dex === 'pancakeswapv3' || dex === 'ramsesv2' ||dex === 'uniswapv4') {
      pairAbi = [
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
      ];
    } else if (dex === 'curve' ) {
      pairAbi = [
        "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)"
      ];
    } else if (dex === 'maverickv2') {
      pairAbi = [
        "function getBin(uint128 binId) external view returns (Bin memory)"
      ];
     } else {
      // Usar ABI padrão para outros DEXes
      pairAbi = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
      ];
    }
    
    const pairContract = new ethers.Contract(pairAddress, pairAbi, provider);
    
    let reserve0, reserve1;
    
    if (dex === 'uniswapv3'|| dex === 'sushiswapv3' || dex === 'pancakeswapv3' || dex === 'ramsesv2') {
      // Uniswap V3 usa um método diferente para armazenar liquidez
      const slot0 = await pairContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // Calcular reservas aproximadas com base no preço
      // Estas são aproximações porque V3 não tem reservas fixas como V2
      const price = (sqrtPriceX96.pow(2).mul(ethers.utils.parseEther("1")))
        .div(ethers.BigNumber.from(2).pow(192));
      
      // Estimar reservas com base no preço (aproximação)
      reserve0 = ethers.utils.parseEther("1000"); // Liquidez base estimada
      reserve1 = reserve0.mul(price).div(ethers.utils.parseEther("1"));
    } else {
      // Uniswap V2 e similares
      const reserves = await pairContract.getReserves();
      reserve0 = reserves.reserve0;
      reserve1 = reserves.reserve1;
    }
    
    // Cache the results
    const [tokenDetails0, tokenDetails1] = await Promise.all([
      fetchTokenDetails(token0, provider),
      fetchTokenDetails(token1, provider)
    ]);
    
    reservesCache[cacheKey] = {
      token0,
      token1,
      reserve0,
      reserve1,
      lastUpdate: now,
      decimals0: tokenDetails0.decimals,
      decimals1: tokenDetails1.decimals,
    };
    
    enhancedLogger.debug(`Fetched reserves for ${pairAddress}: ${reserve0.toString()}, ${reserve1.toString()}`, {
      category: "reserves", 
      botType: "profitCalc"
    });
    
    return { reserve0, reserve1 };
  } catch (err) {
    enhancedLogger.error(`Failed to fetch pair reserves for ${pairAddress}: ${err instanceof Error ? err.message : String(err)}`, {
      category: "reserves", 
      botType: "profitCalc"
    });
    
    return {
      reserve0: ethers.BigNumber.from(0),
      reserve1: ethers.BigNumber.from(0)
    };
  }
}

/**
 * Calcula o impacto de preço de uma troca (swap) na liquidez do pool
 */
function calculatePriceImpact(
  amountIn: ethers.BigNumber,
  reserve0: ethers.BigNumber,
  reserve1: ethers.BigNumber,
  isToken0: boolean,
  fee: number = 0.003 // 0.3% fee padrão
): { 
  priceImpactBps: number, 
  amountOut: ethers.BigNumber,
  newReserve0: ethers.BigNumber,
  newReserve1: ethers.BigNumber
} {
  // Se as reservas forem zero (não pudemos buscar dados), retornar impacto zero
  if (reserve0.isZero() || reserve1.isZero()) {
    return {
      priceImpactBps: 0,
      amountOut: ethers.BigNumber.from(0),
      newReserve0: reserve0,
      newReserve1: reserve1
    };
  }

  // Aplicar taxas (reduzir o valor efetivo que entra no pool)
  const feeMultiplier = Math.floor((1 - fee) * 1000);
  const amountInWithFee = amountIn.mul(feeMultiplier).div(1000);
  
  let amountOut, newReserve0, newReserve1;
  
  if (isToken0) {
    // swap de token0 para token1
    // formula: dy = y * dx / (x + dx)
    const numerator = reserve1.mul(amountInWithFee);
    const denominator = reserve0.add(amountInWithFee);
    amountOut = numerator.div(denominator);
    
    newReserve0 = reserve0.add(amountInWithFee);
    newReserve1 = reserve1.sub(amountOut);
  } else {
    // swap de token1 para token0
    // formula: dx = x * dy / (y + dy)
    const numerator = reserve0.mul(amountInWithFee);
    const denominator = reserve1.add(amountInWithFee);
    amountOut = numerator.div(denominator);
    
    newReserve0 = reserve0.sub(amountOut);
    newReserve1 = reserve1.add(amountInWithFee);
  }
  
  // Calcular preços antes e depois
  const spotPriceBefore = isToken0 
    ? reserve1.mul(ethers.utils.parseEther("1")).div(reserve0)
    : reserve0.mul(ethers.utils.parseEther("1")).div(reserve1);
    
  const spotPriceAfter = isToken0
    ? newReserve1.mul(ethers.utils.parseEther("1")).div(newReserve0)
    : newReserve0.mul(ethers.utils.parseEther("1")).div(newReserve1);
  
  // Calcular o impacto de preço em basis points (1 bps = 0.01%)
  let priceChangePct;
  
  if (isToken0) {
    priceChangePct = spotPriceBefore.sub(spotPriceAfter).mul(10000).div(spotPriceBefore);
  } else {
    priceChangePct = spotPriceAfter.sub(spotPriceBefore).mul(10000).div(spotPriceBefore);
  }
  
  return {
    priceImpactBps: priceChangePct.toNumber(),
    amountOut,
    newReserve0,
    newReserve1
  };
}

/**
 * Calcula o lucro potencial da estratégia de frontrun baseado no impacto de preço
 */
function calculateFrontrunProfit(
  priceImpactBps: number,
  amountIn: ethers.BigNumber,
  liquidityDepth: ethers.BigNumber
): ethers.BigNumber {
  // Para baixos impactos de preço, o lucro é muito baixo ou inexistente
  if (priceImpactBps < 20) { // menos de 0.2%
    return ethers.BigNumber.from(0);
  }
  
  // Lucro depende da profundidade da liquidez e do impacto de preço
  // Um modelo simplificado: quanto maior o impacto, maior a porcentagem que podemos capturar
  
  // Calcular porcentagem do impacto que pode ser capturado
  // Isso é ajustado empiricamente - pools com maior liquidez têm menor captura
  const captureRatio = Math.min(0.6, 0.1 + (priceImpactBps / 1000));
  
  // O frontrunner não pode usar o valor total do amountIn, apenas uma fração
  // que não cause um impacto tão grande a ponto de arruinar o lucro da estratégia
  const optimalFrontrunAmount = amountIn.mul(30).div(100); // 30% do valor original
  
  // Calcular lucro como uma fração do impacto capturado
  const profit = optimalFrontrunAmount
    .mul(Math.floor(priceImpactBps * captureRatio))
    .div(10000);
  
  // Ajustar com base na profundidade da liquidez (pools com baixa liquidez têm maior risco)
  const liquidityFactor = Math.min(100, Math.max(50, 
    liquidityDepth.div(ethers.utils.parseEther("10")).toNumber()));
  
  return profit.mul(liquidityFactor).div(100);
}

/**
 * Identifica o endereço do par de uma transação DEX
 */
async function decodeDexPair(
  tx: ethers.providers.TransactionResponse, 
  dexName: string,
  provider: ethers.providers.Provider
): Promise<{
  pairAddress?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: ethers.BigNumber;
  path?: string[];
}> {
  try {
    // Use the provider passed as parameter instead of trying to get it from tx
    if (!provider) {
      throw new Error("No provider provided");
    }
    
    // Tentar decodificar a função de swap
    const decoded = await decodeSwap(tx);
    
    if (!decoded) {
      enhancedLogger.debug(`Could not decode tx as a DEX swap: ${tx.hash}`, {
        category: "decoder", 
        botType: "profitCalc"
      });
      return {};
    }
    
    enhancedLogger.debug(`Decoded ${dexName} swap: ${decoded.tokenIn} -> ${decoded.tokenOut}, amount: ${decoded.amountIn.toString()}`, {
      category: "decoder", 
      botType: "profitCalc"
    });
    
    // Calcular o endereço do par baseado no tipo de DEX
    let pairAddress = "";
    
    if (dexName === 'uniswapv2' || dexName === 'sushiswapv2') {
      // Para V2, o endereço do par pode ser calculado usando CREATE2
      // Precisamos do factory address e init code hash específicos de cada DEX
      const factoryAddresses: Record<string, string> = {
        'uniswapv2': "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        'sushiswapv2': "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"
      };
      
      const initCodeHashes: Record<string, string> = {
        'uniswapv2': "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f",
        'sushiswapv2': "0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303"
      };
      
      // Ordenar tokens para cálculo do par
      const token0 = decoded.tokenIn.toLowerCase() < decoded.tokenOut.toLowerCase() 
        ? decoded.tokenIn : decoded.tokenOut;
      const token1 = decoded.tokenIn.toLowerCase() < decoded.tokenOut.toLowerCase() 
        ? decoded.tokenOut : decoded.tokenIn;
      
      // Usar CREATE2 para calcular endereço do par
      const factoryAddress = factoryAddresses[dexName] || factoryAddresses['uniswapv2'];
      const initCodeHash = initCodeHashes[dexName] || initCodeHashes['uniswapv2'];
      
      const salt = ethers.utils.solidityKeccak256(
        ['address', 'address'],
        [token0, token1]
      );
      
      pairAddress = ethers.utils.getCreate2Address(
        factoryAddress,
        salt,
        initCodeHash
      );
    } else if (dexName === 'uniswapv3') {
      // Para V3, precisamos do fee tier para calcular o endereço do pool
      // Se não tivermos o fee, podemos tentar os tiers comuns
      const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
      const nfPosManager = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
      
      // Tenta encontrar o pool certo entre os fee tiers comuns
      for (const fee of feeTiers) {
        try {
          const poolAddress = await computeV3PoolAddress(
            decoded.tokenIn,
            decoded.tokenOut,
            fee,
            provider
          );
          
          // Verificar se o pool existe consultando o slot0
          const poolAbi = ["function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"];
          const poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
          
          // Se esta chamada não falhar, o pool existe
          await poolContract.slot0();
          
          // Pool encontrado, usar este endereço
          pairAddress = poolAddress;
          break;
        } catch (e) {
          // Pool não existe com este fee tier, tentar o próximo
          continue;
        }
      }
    }
    
    // Se não conseguimos computar o endereço do par, usar um endereço mockado
    if (!pairAddress) {
      pairAddress = ethers.utils.getCreate2Address(
        tx.to || ethers.constants.AddressZero,
        ethers.utils.solidityKeccak256(['address', 'address'], [decoded.tokenIn, decoded.tokenOut]),
        ethers.utils.solidityKeccak256(['string'], ['pair-init-code-hash'])
      );
    }
    
    return {
      pairAddress,
      tokenIn: decoded.tokenIn,
      tokenOut: decoded.tokenOut,
      amountIn: decoded.amountIn,
      path: decoded.path || [decoded.tokenIn, decoded.tokenOut]
    };
  } catch (err) {
    enhancedLogger.error(`Error decoding DEX transaction: ${err instanceof Error ? err.message : String(err)}`, {
      category: "decoder", 
      botType: "profitCalc"
    });
    return {};
  }
}

/**
 * Helper para computar endereços de pool do Uniswap V3
 */
async function computeV3PoolAddress(
  tokenA: string,
  tokenB: string,
  fee: number,
  provider: ethers.providers.Provider
): Promise<string> {
  // Ordenar tokens (convenção do Uniswap V3)
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB] : [tokenB, tokenA];
  
  // Calcular o endereço do pool usando CREATE2
  const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap V3 factory
  const poolInitCodeHash = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54";
  
  const salt = ethers.utils.solidityKeccak256(
    ['address', 'address', 'uint24'],
    [token0, token1, fee]
  );
  
  return ethers.utils.getCreate2Address(
    factoryAddress,
    salt,
    poolInitCodeHash
  );
}

/**
 * Função principal que analisa uma transação pendente e calcula
 * o impacto de preço e o potencial lucro do frontrunning
 */
export async function getPriceImpactAndProfit(
  tx: ethers.providers.TransactionResponse,
  provider?: ethers.providers.Provider
): Promise<{
  dex: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOut: ethers.BigNumber;
  priceImpactBps: number;
  profit: ethers.BigNumber;
  estimatedGasUsed?: number;
  estimatedGasCost?: ethers.BigNumber;
  estimatedNetProfit?: ethers.BigNumber;
} | null> {
  try {
    enhancedLogger.debug(`Analyzing tx for price impact: ${tx.hash}`, {
      category: "analyzer",
      botType: "profitCalc",
      txHash: tx.hash
    });
    
    // Ordem de DEXes para tentar decodificar, começando pelos mais prováveis
    const dexesToTry = [
      'uniswapv3',
      'sushiswapv3',
      'uniswapv2',
      'sushiswapv2',
      'camelot'
    ];
    
    // Get provider from parameter or use a default one
    const currentProvider = provider || (
      new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc")
    );
    
    // Tentar decodificar a transação com cada DEX até encontrar um match
    let decodedData = null;
    let matchedDex = "uniswapv3"; // Default
    
    for (const dex of dexesToTry) {
      decodedData = await decodeDexPair(tx, dex, currentProvider);
      if (decodedData.tokenIn && decodedData.tokenOut && decodedData.amountIn) {
        matchedDex = dex;
        break;
      }
    }
    
    if (!decodedData || !decodedData.tokenIn || !decodedData.tokenOut || !decodedData.amountIn) {
      enhancedLogger.debug(`Could not identify DEX swap transaction: ${tx.hash}`, {
        category: "analyzer",
        botType: "profitCalc"
      });
      return null;
    }
    
    const { pairAddress, tokenIn, tokenOut, amountIn, path } = decodedData;
    
    if (!pairAddress) {
      enhancedLogger.debug(`Could not determine pair address: ${tx.hash}`, {
        category: "analyzer",
        botType: "profitCalc"
      });
      return null;
    }
    
    // Buscar dados de liquidez do par
    const { reserve0, reserve1 } = await fetchPairReserves(
      pairAddress,
      tokenIn,
      tokenOut,
      currentProvider,
      matchedDex as DexType
    );
    
    // Determinar se tokenIn é token0 ou token1
    const isToken0In = tokenIn.toLowerCase() < tokenOut.toLowerCase();
    
    // Calcular impacto de preço
    const impact = calculatePriceImpact(
      amountIn,
      isToken0In ? reserve0 : reserve1,
      isToken0In ? reserve1 : reserve0,
      isToken0In
    );
    
    // Se impacto for pequeno demais, não vale a pena
    if (impact.priceImpactBps < 50) { // menos de 0.5%
      enhancedLogger.debug(`Price impact too small for frontrunning: ${impact.priceImpactBps / 100}%`, {
        category: "analyzer",
        botType: "profitCalc"
      });
      return null;
    }
    
    // Calcular a profundidade de liquidez em USD para tomada de decisão
    let liquidityDepthUsd = ethers.BigNumber.from(0);
    
    try {
      const tokenInPrice = await getTokenPrice(tokenIn, currentProvider);
      const tokenOutPrice = await getTokenPrice(tokenOut, currentProvider);
      
      // Calcular profundidade de liquidez em USD usando o token de maior valor
      if (tokenInPrice > BigInt(0)) {
        const tokenInDetails = await fetchTokenDetails(tokenIn, currentProvider);
        const tokenInAmount = reserve0.mul(ethers.BigNumber.from(10).pow(18 - tokenInDetails.decimals));
        // Convert bigint to number before multiplication
        const tokenInPriceNumber = Number(tokenInPrice) / 1e18;
        liquidityDepthUsd = ethers.BigNumber.from(
          Math.floor(Number(tokenInAmount) * tokenInPriceNumber)
        );
      } else if (tokenOutPrice > BigInt(0)) {
        const tokenOutDetails = await fetchTokenDetails(tokenOut, currentProvider);
        const tokenOutAmount = reserve1.mul(ethers.BigNumber.from(10).pow(18 - tokenOutDetails.decimals));
        // Convert bigint to number before multiplication
        const tokenOutPriceNumber = Number(tokenOutPrice) / 1e18;
        liquidityDepthUsd = ethers.BigNumber.from(
          Math.floor(Number(tokenOutAmount) * tokenOutPriceNumber)
        );
      }
    } catch (err) {
      enhancedLogger.warn(`Error getting token prices: ${err instanceof Error ? err.message : String(err)}`, {
        category: "analyzer",
        botType: "profitCalc"
      });
      // Continuar com valor padrão de liquidityDepthUsd
    }
    
    // Calcular lucro potencial da estratégia de frontrun
    const profit = calculateFrontrunProfit(
      impact.priceImpactBps,
      amountIn,
      liquidityDepthUsd.isZero() ? ethers.utils.parseEther("10000") : liquidityDepthUsd
    );
    
    // Estimar gas usado e custo
    const estimatedGasUsed = matchedDex === 'uniswapv3' ? 350000 : 250000; // estimativa de gas
    const gasPriceGwei = tx.gasPrice ? 
      parseFloat(ethers.utils.formatUnits(tx.gasPrice, "gwei")) : 
      1.0;
    
    const estimatedGasCost = ethers.utils.parseUnits(
      (estimatedGasUsed * gasPriceGwei * 1.2 / 1e9).toString(), // 20% buffer
      "ether"
    );
    
    // Lucro líquido após custos de gas
    const estimatedNetProfit = profit.sub(estimatedGasCost);
    
    if (estimatedNetProfit.lte(0)) {
      enhancedLogger.debug(`Transaction not profitable after gas costs: ${tx.hash}`, {
        category: "analyzer",
        botType: "profitCalc"
      });
      return null;
    }
    
    enhancedLogger.info(`Found profitable frontrun opportunity: ${tx.hash}`, {
      category: "analyzer",
      botType: "profitCalc",
      priceImpactBps: impact.priceImpactBps,
      estimatedProfit: ethers.utils.formatEther(profit),
      estimatedNetProfit: ethers.utils.formatEther(estimatedNetProfit)
    });
    
    return {
      dex: matchedDex,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: impact.amountOut,
      priceImpactBps: impact.priceImpactBps,
      profit,
      estimatedGasUsed,
      estimatedGasCost,
      estimatedNetProfit
    };
  } catch (error) {
    enhancedLogger.error(`Error calculating price impact: ${error instanceof Error ? error.message : String(error)}`, {
      category: "analyzer",
      botType: "profitCalc",
      txHash: tx.hash
    });
    
    return null;
  }
}
