import { ethers } from "ethers";
import { COMMON_TOKENS_ARBITRUM } from "../constants/addresses";
import { CHAINLINK_FEEDS } from "../constants/addresses";
import { AggregatorV3InterfaceABI } from "../constants/abis";
import { enhancedLogger } from "./enhancedLogger";

// Interface para o cache
interface TokenPriceCache {
  price: bigint;
  timestamp: number;
}

const priceCache: Record<string, TokenPriceCache> = {};
const CACHE_TTL = 60 * 1000; // 60 segundos

// Preços fixos para fallback
const fixedPrices: Record<string, bigint> = {
  [COMMON_TOKENS_ARBITRUM.WETH.toLowerCase()]: ethers.utils.parseEther("3000").toBigInt(),
  [COMMON_TOKENS_ARBITRUM.USDC.toLowerCase()]: ethers.utils.parseUnits("1", 6).toBigInt(),
  [COMMON_TOKENS_ARBITRUM.USDT.toLowerCase()]: ethers.utils.parseUnits("1", 6).toBigInt(),
  [COMMON_TOKENS_ARBITRUM.DAI.toLowerCase()]: ethers.utils.parseEther("1").toBigInt(),
  [COMMON_TOKENS_ARBITRUM.WBTC.toLowerCase()]: ethers.utils.parseUnits("50000", 8).toBigInt(),
  [COMMON_TOKENS_ARBITRUM.ARB.toLowerCase()]: ethers.utils.parseEther("1.5").toBigInt(),
  [COMMON_TOKENS_ARBITRUM.GMX.toLowerCase()]: ethers.utils.parseEther("45").toBigInt(),
};

// Função auxiliar para buscar o preço do Chainlink
async function getPriceFromChainlink(
  tokenAddress: string,
  provider: ethers.providers.Provider
): Promise<bigint | null> {
  const feedAddress = CHAINLINK_FEEDS[tokenAddress.toLowerCase()];
  if (!feedAddress) return null;

  try {
    const aggregator = new ethers.Contract(feedAddress, AggregatorV3InterfaceABI, provider);
    const [, answer] = await aggregator.latestRoundData();
    const decimals = await aggregator.decimals();

    if (answer.lte(0)) return null;

    return ethers.utils.parseUnits(answer.toString(), 18 - decimals).toBigInt();
  } catch (err) {
    enhancedLogger.warn(`Chainlink erro para ${tokenAddress}:`, { data: err });
    return null;
  }
}

// Função principal
export async function getTokenPrice(
  tokenAddress: string,
  provider: ethers.providers.Provider
): Promise<bigint> {
  const normalized = tokenAddress.toLowerCase();
  const now = Date.now();

  // Verificar cache
  if (priceCache[normalized] && now - priceCache[normalized].timestamp < CACHE_TTL) {
    return priceCache[normalized].price;
  }

  // 1. Tentar Chainlink
  const chainlinkPrice = await getPriceFromChainlink(normalized, provider);
  if (chainlinkPrice) {
    priceCache[normalized] = { price: chainlinkPrice, timestamp: now };
    return chainlinkPrice;
  }

  // 2. Fallback: preço fixo
  if (fixedPrices[normalized]) {
    const fixed = fixedPrices[normalized];
    priceCache[normalized] = { price: fixed, timestamp: now };
    enhancedLogger.debug(`Using fixed price for ${normalized}`);
    return fixed;
  }

  // 3. Fallback genérico
  const defaultPrice = ethers.utils.parseEther("1").toBigInt(); // 1 USD
  priceCache[normalized] = { price: defaultPrice, timestamp: now };
  enhancedLogger.warn(`Defaulting to 1 USD for unknown token ${normalized}`);
  return defaultPrice;
}
