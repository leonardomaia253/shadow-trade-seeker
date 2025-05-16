
import { ethers } from "ethers";
import { CallData, DexType } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";

// Implementation of swap builders for various DEXes
export async function buildSwapTransaction({
  fromToken,
  toToken,
  amount,
  slippage = 0.01,
  dex = "uniswapv3"
}: {
  fromToken: string;
  toToken: string;
  amount: ethers.BigNumber;
  slippage?: number;
  dex?: string;
}): Promise<CallData> {
  try {
    // Calcular valor mínimo aceitável considerando slippage
    const amountOutMin = amount.mul(Math.floor((1 - slippage) * 10000)).div(10000);
    
    // Mock implementation for all DEXes - in a real scenario, these would be implemented properly
    const routerAddress = getRouterAddress(dex as DexType);
    const swapData = "0x00"; // This would be actual swap calldata in a real implementation
    
    return {
      target: routerAddress,
      to: routerAddress,
      callData: swapData,
      data: swapData,
      dex: dex as DexType,
      requiresApproval: true,
      approvalToken: fromToken,
      approvalAmount: amount
    };
  } catch (err) {
    enhancedLogger.error(`Error building swap transaction: ${err instanceof Error ? err.message : String(err)}`, {
      data: err
    });
    throw err;
  }
}

// Helper function to get router addresses
function getRouterAddress(dex: DexType): string {
  const routers: Record<DexType, string> = {
    uniswapv2: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    uniswapv3: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
    sushiswapv3: "0xA7caC4207579A179c1069435d032ee0F9F150e5c", 
    uniswapv4: "0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3", 
    camelot: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d", 
    maverickv2: "0x5c3b380e5Aeec389d1014Da3Eb372FA2C9e0fc76",
    curve: "0x2191718cd32d02b8e60badffea33e4b5dd9a0a0d", 
    sushiswapv2: "0xA7caC4207579A179c1069435d032ee0F9F150e5c",
    pancakeswapv3: "0x13f4ea83d0bd40e75c8222255bc855a974568dd4",
    ramsesv2: "0xaa273216cc9201a1e4285ca623f584badc736944",
  };
  
  return routers[dex] || routers.uniswapv3;
}

// Export mock builders for all DEXes to be used by other modules
export const buildUniswapV2Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "uniswapv2"});
};

export const buildUniswapV3Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "uniswapv3"});
};

export const buildUniswapV4Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "uniswapv4"});
};

export const buildSushiswapV2Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "sushiswapv2"});
};

export const buildSushiswapV3Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "sushiswapv3"});
};

export const buildPancakeswapV3Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "pancakeswapv3"});
};

export const buildCamelotSwap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "camelot"});
};

export const buildMaverickV2Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "maverickv2"});
};

export const buildRamsesV2Swap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "ramsesv2"});
};

export const buildCurveSwap = async (fromToken: string, toToken: string, amount: ethers.BigNumber, amountOutMin: ethers.BigNumber) => {
  return buildSwapTransaction({fromToken, toToken, amount, dex: "curve"});
};
