}import { ethers } from "ethers";
import { TokenInfo } from "./types";
import { provider } from "../config/provider";
import { getTokenPriceInEth } from "./getTokenPriceInEth";



interface GasInfo {
  gasPrice: ethers.BigNumber;
  ethPrice: ethers.BigNumber;

export async function getGasCostInToken({
  provider: providerInput,
  gasUnits,
  token,
}: {
  provider?: ethers.providers.Provider;
  gasUnits: ethers.BigNumberish;
  token: TokenInfo;
}): Promise<ethers.BigNumber> {
  const providerInstance = providerInput || provider;

  try {
    const gasPrice = await providerInstance.getGasPrice();
    const gasEstimateWei = ethers.BigNumber.from(gasUnits).mul(gasPrice);

    // Se for WETH (ETH), retorna diretamente
    if (token.address.toLowerCase() === "0x82af49447d8a07e3bd95bd0d56f35241523fbab1") {
      return gasEstimateWei;
    }

    const tokenPriceInEth = await getTokenPriceInEth(token.address, providerInstance);

    if (tokenPriceInEth.isZero()) {
      console.warn(`Token price in ETH not found for ${token.symbol}, fallback to gasEstimateWei`);
      return gasEstimateWei;
    }

    const tokenDecimals = token.decimals;
    const result = gasEstimateWei
      .mul(ethers.BigNumber.from(10).pow(tokenDecimals))
      .div(tokenPriceInEth); // ETH/token -> token

    return result;
  } catch (error) {
    console.error("Error calculating gas cost:", error);
    return ethers.BigNumber.from(0);
  }
}

/**
 * Estimate gas usage for a sequence of operations
 */
export async function estimateGasUsage(path: string[]): Promise<ethers.BigNumber> {
  try {
    // Basic estimate based on operation count
    const baseGas = 150000; // Gas for basic operations
    const swapGas = 100000; // Gas per swap
    
    const totalGas = baseGas + (path.length - 1) * swapGas;
    return ethers.BigNumber.from(totalGas);
  } catch (error) {
    console.error("Error estimating gas usage:", error);
    return ethers.BigNumber.from(500000); // Safe default
  }
}

/**
 * Calculate ETH equivalent of gas cost
 */
export function calculateEthForGas(gasUnits: ethers.BigNumber, gasPrice: ethers.BigNumber): ethers.BigNumber {
  try {
    return gasUnits.mul(gasPrice);
  } catch (error) {
    console.error("Error calculating ETH for gas:", error);
    return ethers.BigNumber.from(0);
  }
}
