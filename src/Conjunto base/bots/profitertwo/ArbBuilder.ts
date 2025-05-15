
import { ethers } from 'ethers';
import { provider } from '../../config/provider';
import { enhancedLogger } from '../../utils/enhancedLogger';
import { DEX_ROUTER } from '../../constants/addresses';
import { DexType, BuiltRoute, CallData } from '../../utils/types';
import { getTokenPrice } from '../../utils/getTokenPrice';
import { builSwapTransaction } from '../../shared/build/buildSwap';

/**
 * Find and build arbitrage routes between tokens
 */
export async function buildArbitrageRoute({
  startToken,
  tokens,
  dexes,
  maxHops = 3,
  minProfitUsd = 20
}: {
  startToken: string;
  tokens: string[];
  dexes: DexType[];
  maxHops?: number;
  minProfitUsd?: number;
}): Promise<BuiltRoute | null> {
  try {
    enhancedLogger.info(`Building arbitrage route from ${startToken}`, {
      category: "builder",
      botType: "profiter"
    });
    
    // Obter tokens disponíveis nos principais DEXs
    const availableTokens = [startToken, ...tokens];
    
    // Gerar possíveis caminhos de arbitragem
    const paths = await generatePotentialPaths(startToken, availableTokens, dexes, maxHops);
    
    // Encontrar o caminho mais lucrativo
    const mostProfitablePath = await findMostProfitablePath(paths, minProfitUsd);
    
    if (!mostProfitablePath) {
      enhancedLogger.debug("No profitable arbitrage opportunity found", {
        category: "builder",
        botType: "profiter"
      });
      return null;
    }
    
    // Construir a rota com os swaps necessários
    const builtRoute = await buildRoute(mostProfitablePath);
    
    enhancedLogger.info(`Built arbitrage route with ${builtRoute.swaps.length} swaps and expected profit: $${builtRoute.profitUsd.toFixed(2)}`, {
      category: "builder",
      botType: "profiter",
      data: {
        route: builtRoute.path,
        expectedProfit: builtRoute.expectedProfit.toString(),
        profitUsd: builtRoute.profitUsd
      }
    });
    
    return builtRoute;
  } catch (error) {
    enhancedLogger.error(`Error building arbitrage route: ${error instanceof Error ? error.message : "Unknown error"}`, {
      category: "builder",
      botType: "profiter",
      data: error
    });
    return null;
  }
}

/**
 * Gerar potenciais caminhos de arbitragem
 */
async function generatePotentialPaths(
  startToken: string,
  tokens: string[],
  dexes: DexType[],
  maxHops: number
): Promise<{
  path: string[];
  dexSequence: DexType[];
}[]> {
  const paths: {
    path: string[];
    dexSequence: DexType[];
  }[] = [];
  
  function dfs(
    currentPath: string[],
    currentDexs: DexType[],
    depth: number,
    visited: Set<string>
  ) {
    // Base case: quando atingimos o número máximo de hops
    if (depth === maxHops) {
      // Adicionar o token inicial para fechar o ciclo
      const completePath = [...currentPath, startToken];
      
      // Adicionar DEX para o último hop
      const completeDexs = [
        ...currentDexs,
        dexes[Math.floor(Math.random() * dexes.length)]
      ];
      
      paths.push({
        path: completePath,
        dexSequence: completeDexs
      });
      
      return;
    }
    
    // Recursion: tentar adicionar cada token não visitado ao caminho
    for (const token of tokens) {
      if (token !== currentPath[currentPath.length - 1] && !visited.has(token)) {
        visited.add(token);
        currentPath.push(token);
        currentDexs.push(dexes[Math.floor(Math.random() * dexes.length)]);
        
        dfs(currentPath, currentDexs, depth + 1, visited);
        
        currentPath.pop();
        currentDexs.pop();
        visited.delete(token);
      }
    }
  }
  
  // Iniciar DFS do token inicial
  dfs([startToken], [], 0, new Set([startToken]));
  
  return paths;
}

/**
 * Encontrar o caminho mais lucrativo
 */
async function findMostProfitablePath(
  paths: {
    path: string[];
    dexSequence: DexType[];
  }[],
  minProfitUsd: number
): Promise<{
  path: string[];
  dexSequence: DexType[];
  profit: ethers.BigNumber;
  profitUsd: number;
} | null> {
  let mostProfitablePath: {
    path: string[];
    dexSequence: DexType[];
    profit: ethers.BigNumber;
    profitUsd: number;
  } | null = null;
  
  for (const path of paths) {
    try {
      const { profit, profitUsd } = await simulateArbitragePath(path.path, path.dexSequence);
      
      if (profitUsd >= minProfitUsd && 
          (!mostProfitablePath || profitUsd > mostProfitablePath.profitUsd)) {
        mostProfitablePath = {
          ...path,
          profit,
          profitUsd
        };
      }
    } catch (error) {
      enhancedLogger.debug(`Error simulating path: ${error instanceof Error ? error.message : "Unknown error"}`, {
        category: "builder",
        botType: "profiter",
        data: {
          path: path.path,
          error
        }
      });
    }
  }
  
  return mostProfitablePath;
}

/**
 * Simular um caminho de arbitragem para calcular o lucro
 */
async function simulateArbitragePath(
  path: string[],
  dexSequence: DexType[]
): Promise<{
  profit: ethers.BigNumber;
  profitUsd: number;
}> {
  // Quantidade inicial (1 ETH ou token equivalente)
  const initialAmount = ethers.utils.parseEther("1");
  let currentAmount = initialAmount;
  
  // Simular cada hop no caminho
  for (let i = 0; i < path.length - 1; i++) {
    const fromToken = path[i];
    const toToken = path[i + 1];
    const dex = dexSequence[i];
    
    // Obter taxa de câmbio do DEX
    const toAmount = await getExchangeRate(fromToken, toToken, currentAmount, dex);
    
    // Atualizar a quantidade atual
    currentAmount = toAmount;
  }
  
  // Calcular lucro em tokens
  const profit = currentAmount.sub(initialAmount);
  
  // Calcular valor USD do token inicial
  const tokenPrice = await getTokenPrice(path[0], provider);
  
  // Converter lucro para USD
  const profitUsd = parseFloat(ethers.utils.formatEther(profit)) * 
                   parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(tokenPrice.toString())));
  
  return { profit, profitUsd };
}

/**
 * Obter taxa de câmbio de um DEX
 */
async function getExchangeRate(
  fromToken: string,
  toToken: string,
  amountIn: ethers.BigNumber,
  dex: DexType
): Promise<ethers.BigNumber> {
  try {
    const routerAddress = DEX_ROUTER[dex];
    if (!routerAddress) {
      throw new Error(`Router address not found for DEX: ${dex}`);
    }
    
    // Interface específica para o tipo de DEX
    let routerInterface;
    let method;
    
    if (dex.includes('v2') || dex === 'sushiswap_v2' || dex === 'uniswap_v2') {
      // DEXs baseados no Uniswap V2
      routerInterface = new ethers.utils.Interface([
        "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)"
      ]);
      
      method = "getAmountsOut";
      const result = await provider.call({
        to: routerAddress,
        data: routerInterface.encodeFunctionData(method, [
          amountIn,
          [fromToken, toToken]
        ])
      });
      
      const amounts = routerInterface.decodeFunctionResult(method, result);
      return amounts[0][1]; // O segundo valor no array é a quantidade de saída
      
    } else if (dex.includes('v3') || dex === 'uniswap_v3' || dex === 'sushiswap_v3') {
      // DEXs baseados no Uniswap V3
      const quoterAddress = getQuoterAddress(dex);
      const quoterInterface = new ethers.utils.Interface([
        "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)"
      ]);
      
      method = "quoteExactInputSingle";
      const result = await provider.call({
        to: quoterAddress,
        data: quoterInterface.encodeFunctionData(method, [
          fromToken,
          toToken,
          3000, // fee (0.3% é comum)
          amountIn,
          0 // sqrtPriceLimitX96 (0 significa sem limite)
        ])
      });
      
      const amountOut = quoterInterface.decodeFunctionResult(method, result)[0];
      return amountOut;
      
    } else if (dex === 'camelot') {
      // Camelot tem uma interface similar ao Uniswap V2
      routerInterface = new ethers.utils.Interface([
        "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)"
      ]);
      
      method = "getAmountsOut";
      const result = await provider.call({
        to: routerAddress,
        data: routerInterface.encodeFunctionData(method, [
          amountIn,
          [fromToken, toToken]
        ])
      });
      
      const amounts = routerInterface.decodeFunctionResult(method, result);
      return amounts[0][1];
    }
    
    // Fallback: retornar 98% do valor de entrada (assumindo 2% de slippage)
    return amountIn.mul(98).div(100);
    
  } catch (error) {
    enhancedLogger.debug(`Error getting exchange rate: ${error instanceof Error ? error.message : "Unknown error"}`, {
      category: "builder",
      botType: "profiter",
      data: {
        fromToken,
        toToken,
        dex,
        error
      }
    });
    
    // Em caso de erro, retornar uma estimativa pessimista
    return amountIn.mul(97).div(100); // 3% de slippage
  }
}

/**
 * Obter endereço do Quoter para DEXs V3
 */
function getQuoterAddress(dex: DexType): string {
  switch (dex) {
    case 'uniswap_v3':
      return '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'; // Uniswap V3 Quoter Arbitrum
    case 'sushiswap_v3':
      return '0xbe330b6591a4a9145504Ae31f5F6CC2D11Fd6c2a'; // SushiSwap V3 Quoter Arbitrum
    default:
      throw new Error(`Quoter address not available for DEX: ${dex}`);
  }
}

/**
 * Construir rota completa com swaps
 */
async function buildRoute(
  profitablePath: {
    path: string[];
    dexSequence: DexType[];
    profit: ethers.BigNumber;
    profitUsd: number;
  }
): Promise<BuiltRoute> {
  const signer = provider.getSigner();
  
  // Quantidade inicial para o primeiro swap (1 ETH ou equivalente)
  const initialAmount = ethers.utils.parseEther("1");
  
  const swaps = [];
  let currentAmount = initialAmount;
  
  // Construir cada swap no caminho
  for (let i = 0; i < profitablePath.path.length - 1; i++) {
    const fromToken = profitablePath.path[i];
    const toToken = profitablePath.path[i + 1];
    const dex = profitablePath.dexSequence[i];
    
    // Codificar chamada de swap
    const swapData = await builSwapTransaction({
      signer,
      router: DEX_ROUTER[dex],
      fromToken,
      toToken,
      amountIn: currentAmount,
      dex
    });
    
    // Simular o resultado deste swap
    const amountOut = await getExchangeRate(fromToken, toToken, currentAmount, dex);
    currentAmount = amountOut;
    
    swaps.push({
      dex: dex,
      target: swapData.to,
      callData: swapData.data,
      amountIn: currentAmount,
      amountOut: amountOut,
      fromToken: fromToken,
      toToken: toToken,
      approveToken: fromToken,
      flashloanProvider: i === 0 ? "aave_v3" : undefined
    });
  }
  
  return {
    tokens: profitablePath.path,
    path: profitablePath.path,
    expectedProfit: profitablePath.profit,
    profitUsd: profitablePath.profitUsd,
    swaps
  };
}

/**
 * Convert DexSwap to CallData format
 */
export async function dexSwapToCallData(
  signer: ethers.Signer,
  fromToken: string,
  toToken: string,
  amountIn: ethers.BigNumber,
  dex: DexType
): Promise<CallData> {
  try {
    // Get router address for the selected DEX
    const router = DEX_ROUTER[dex];
    if (!router) {
      throw new Error(`Router not found for DEX: ${dex}`);
    }
    
    // Encode the swap call
    const swapData = await builSwapTransaction({
      signer,
      router,
      fromToken,
      toToken,
      amountIn,
      dex
    });
    
    return {
      to: swapData.to,
      target: swapData.to,
      data: swapData.data,
      value: swapData.value,
      requiresApproval: true,
      approvalToken: fromToken,
      approvalAmount: amountIn
    };
  } catch (error) {
    enhancedLogger.error(`Error converting swap to calldata: ${error instanceof Error ? error.message : "Unknown error"}`, {
      category: "builder",
      botType: "profiter",
      data: error
    });
    throw error;
  }
}
