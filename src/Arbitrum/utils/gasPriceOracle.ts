
import { ethers, BigNumber } from "ethers";
import { CHAINLINK_FEED_REGISTRY, WETH } from "../constants/addresses";
import { enhancedLogger } from "./enhancedLogger";

// Interface para o Feed Registry da Chainlink
const FEED_REGISTRY_ABI = [
  "function latestRoundData(address base, address quote) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals(address base, address quote) external view returns (uint8)"
];

// Interface para o Gas Price Oracle do Arbitrum
const GAS_PRICE_ORACLE_ABI = [
  "function gasPrice() external view returns (uint256)",
  "function getPricesInWei() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
];

// USD feed para ETH
const USD_ADDRESS = "0x0000000000000000000000000000000000000348";

/**
 * Obtém o preço atual do ETH em USD usando o Chainlink Feed Registry
 */
export async function getEthPriceInUSD(provider: ethers.providers.Provider): Promise<number> {
  try {
    const feedRegistry = new ethers.Contract(
      CHAINLINK_FEED_REGISTRY, 
      FEED_REGISTRY_ABI, 
      provider
    );

    // Obter os dados mais recentes do par ETH/USD
    const [, answer, , , ] = await feedRegistry.latestRoundData(WETH, USD_ADDRESS);
    const decimals = await feedRegistry.decimals(WETH, USD_ADDRESS);
    
    // Converter para um valor decimal
    const price = Number(answer) / Math.pow(10, decimals);
    
    enhancedLogger.info(`Preço atual de ETH: $${price.toFixed(2)} USD`, {
      category: 'pricing'
    });
    
    return price;
  } catch (error) {
    enhancedLogger.error(`Erro ao obter preço do ETH: ${error instanceof Error ? error.message : String(error)}`, {
      category: 'pricing',
      data: error
    });
    
    // Valor fallback em caso de erro
    return 1800; // Valor médio aproximado do ETH
  }
}

/**
 * Obtém o preço do gás atual no Arbitrum
 */
export async function getCurrentGasPrice(provider: ethers.providers.Provider): Promise<BigNumber> {
  try {
    // No Arbitrum, usamos a API de gas price padrão
    const gasPrice = await provider.getGasPrice();
    
    enhancedLogger.debug(`Gas price atual: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`, {
      category: 'gas'
    });
    
    return gasPrice;
  } catch (error) {
    enhancedLogger.error(`Erro ao obter gas price: ${error instanceof Error ? error.message : String(error)}`, {
      category: 'gas',
      data: error
    });
    
    // Valor fallback em caso de erro
    return ethers.utils.parseUnits("0.1", "gwei");
  }
}

/**
 * Calcula o custo real de gás em ETH baseado em uso de gás e preço do gás
 */
export async function calculateGasCostInETH(
  provider: ethers.providers.Provider,
  gasLimit: BigNumber
): Promise<BigNumber> {
  const gasPrice = await getCurrentGasPrice(provider);
  const gasCost = gasPrice.mul(gasLimit);
  
  enhancedLogger.debug(`Custo de gás estimado: ${ethers.utils.formatEther(gasCost)} ETH`, {
    category: 'gas',
    data: {
      gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
      gasLimit: gasLimit.toString(),
      gasCost: ethers.utils.formatEther(gasCost)
    }
  });
  
  return gasCost;
}

/**
 * Calcula o custo de gás em USD
 */
export async function calculateGasCostInUSD(
  provider: ethers.providers.Provider,
  gasLimit: BigNumber
): Promise<number> {
  const gasCostEth = await calculateGasCostInETH(provider, gasLimit);
  const ethPrice = await getEthPriceInUSD(provider);
  
  const gasCostUsd = Number(ethers.utils.formatEther(gasCostEth)) * ethPrice;
  
  enhancedLogger.debug(`Custo de gás em USD: $${gasCostUsd.toFixed(2)}`, {
    category: 'gas'
  });
  
  return gasCostUsd;
}

/**
 * Estima o custo de gás para um conjunto de operações de arbitragem
 * com valores reais usando preços atuais de gás
 */
export async function estimateArbitrageGasCost(
  provider: ethers.providers.Provider,
  swapsCount: number
): Promise<BigNumber> {
  // Estimativa base de custo de gás por swap
  const gasPerSwap = BigNumber.from(150000);
  
  // Custo adicional para flash loans e operações de orquestração
  const baseGasCost = BigNumber.from(300000);
  
  // Calcular gás total
  const totalGasLimit = baseGasCost.add(gasPerSwap.mul(swapsCount));
  
  // Obter custo em ETH
  const gasCostEth = await calculateGasCostInETH(provider, totalGasLimit);
  
  enhancedLogger.info(`Custo de gás estimado para arbitragem com ${swapsCount} swaps: ${ethers.utils.formatEther(gasCostEth)} ETH`, {
    category: 'arbitrage',
    data: {
      swapsCount,
      gasLimit: totalGasLimit.toString(),
      gasCostEth: ethers.utils.formatEther(gasCostEth)
    }
  });
  
  return gasCostEth;
}
