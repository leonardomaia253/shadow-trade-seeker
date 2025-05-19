
import { BigNumber, ethers } from "ethers";
import { provider } from "../config/provider";
import { DexType } from "../utils/types";
import { UNISWAP_V2_ROUTER_ABI, UNISWAP_V3_ROUTER_ABI } from "../constants/abis";
import { COMMON_TOKENS_ARBITRUM } from "../constants/addresses";

interface FlashLoanResult {
  flashLoanToken: string;
  flashLoanAmount: BigNumber;
}

export async function selectFlashloanToken({ 
  dex, 
  tokenIn, 
  amountIn 
}: { 
  dex: DexType | string; 
  tokenIn: string; 
  amountIn: BigNumber;
}): Promise<FlashLoanResult | undefined> {
  // Default to WETH for flashloan token
  const flashLoanToken = COMMON_TOKENS_ARBITRUM.WETH;
  
  try {
    // Set a generous flashloan amount based on tokenIn amount
    // In a real implementation, you would calculate this more precisely
    const flashLoanAmount = amountIn.mul(110).div(100); // 110% of amountIn
    
    return {
      flashLoanToken,
      flashLoanAmount
    };
  } catch (error) {
    console.error("Error selecting flashloan token:", error);
    return undefined;
  }
}
