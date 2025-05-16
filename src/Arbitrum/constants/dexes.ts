
import { DexType } from "../utils/types";

/**
 * Endereços dos roteadores de DEX no Arbitrum
 */
export const DEX_ROUTER: Record<DexType, string> = {
  uniswapv2: "0x0000000000000000000000000000000000000000", // Não existe no Arbitrum
  uniswapv3: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 SwapRouter
  uniswapv4: "0x0000000000000000000000000000000000000000", // Ainda não lançado
  sushiswapv2: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap V2 Router
  sushiswapv3: "0x8A21F6768C1f8075791D08546Daec9e7C4A86CdD", // SushiSwap V3 Router
  pancakeswapv3: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", // PancakeSwap V3 Router
  curve: "0x445FE580eF8d70FF569aB36e80c647af338db351", // Curve Pool Registry
  camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d", // Camelot V2 Router
  maverickv2: "",
  ramsesv2:""
};

/**
 * Fees padrão para DEXes
 */
export const DEX_DEFAULT_FEES: Record<DexType, number> = {
  uniswapv2: 3000, // 0.3%
  uniswapv3: 3000, // 0.3%
  uniswapv4: 3000, // 0.3%
  sushiswapv2: 3000, // 0.3%
  sushiswapv3: 3000, // 0.3%
  pancakeswapv3: 2500, // 0.25%
  maverickv2: 2500,
  ramsesv2: 2500,
  curve: 400, // 0.04%
  camelot: 3000, // 0.3%
};

/**
 * Tiers de fee disponíveis para DEXes
 */
export const DEX_FEE_TIERS: Record<DexType, number[]> = {
  uniswapv3: [100, 500, 3000, 10000], // 0.01%, 0.05%, 0.3%, 1%
  sushiswapv3: [100, 500, 3000, 10000], // 0.01%, 0.05%, 0.3%, 1%
  pancakeswapv3: [100, 500, 2500, 10000], // 0.01%, 0.05%, 0.25%, 1%
  uniswapv2: [3000], // 0.3%
  sushiswapv2: [3000], // 0.3%
  maverickv2: [2500], // 0.25%
  curve: [100, 400, 1000], // 0.01%, 0.04%, 0.1%
  camelot: [3000, 5000, 8000], // 0.3%, 0.5%, 0.8%
  uniswapv4: [1000, 3000, 5000], // 0.1%, 0.3%, 0.5%
  uniswapv4: [100, 500, 3000, 10000] // 0.01%, 0.05%, 0.3%, 1% 
};
