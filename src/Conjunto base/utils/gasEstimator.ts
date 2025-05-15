
import { ethers } from "ethers";
import { getProvider } from "../config/provider";
import { TokenInfo } from "../utils/types";
import { getQuote } from "../shared/build/getQuote";

// Common stablecoin and base token addresses
const WETH_ADDRESS = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; //  WETH
const USDC_ADDRESS = "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"; //  USDC

// Get token price in terms of ETH using actual DEX quotes
async function getTokenPrice(token: TokenInfo): Promise<number> {
  try {
    // If the token is WETH or ETH, return 1 (1 ETH = 1 ETH)
    if (token.symbol.toUpperCase() === "ETH" || token.symbol.toUpperCase() === "WETH") {
      return 1;
    }

    // For stablecoins, we know they're approximately $1
    if (["USDC", "USDT", "DAI", "BUSD", "TUSD", "USDP", "GUSD", "FRAX", "LUSD"].includes(token.symbol.toUpperCase())) {
      // Get ETH price in USD by checking WETH → USDC
      const ethToUsdQuote = await getQuote(
        WETH_ADDRESS,
        USDC_ADDRESS,
        BigInt(ethers.utils.parseUnits("1", 18).toString())
      );

      if (ethToUsdQuote.paths.length > 0) {
        // Convert from 6 decimals (USDC) to price in USD
        const ethPriceInUsd = Number(ethers.utils.formatUnits(ethToUsdQuote.paths[0].output.toString(), 6));
        return 1 / ethPriceInUsd; // Return ETH/USD rate
      }
      
      // Fallback if quote fails
      return 1/3500;
    }

    // For other tokens, get price relative to ETH
    const tokenToEthQuote = await getQuote(
      token.address,
      WETH_ADDRESS,
      BigInt(ethers.utils.parseUnits("1", token.decimals).toString())
    );

    if (tokenToEthQuote.paths.length > 0) {
      // Convert output to price (1 token = X ETH)
      return Number(ethers.utils.formatEther(tokenToEthQuote.paths[0].output.toString()));
    }

    // Try reverse quote (ETH to token) if direct quote fails
    const ethToTokenQuote = await getQuote(
      WETH_ADDRESS,
      token.address,
      BigInt(ethers.utils.parseUnits("1", 18).toString())
    );

    if (ethToTokenQuote.paths.length > 0) {
      // Convert output to ethers format with proper decimals
      const tokenAmount = Number(ethers.utils.formatUnits(ethToTokenQuote.paths[0].output.toString(), token.decimals));
      // Price = 1/tokenAmount
      return tokenAmount > 0 ? 1 / tokenAmount : 0;
    }

    // Fallback to default values if no quotes are available
    switch(token.symbol.toUpperCase()) {
      case "WBTC":
        return 16; // ~16 ETH per BTC
      default:
        return 0.0001; // Default assumption: token is worth 0.0001 ETH
    }
  } catch (error) {
    console.error(`Error getting price for token ${token.symbol}:`, error);
    return 0.0001; // Default fallback
  }
}

export async function estimateGasUsage(path: TokenInfo[]): Promise<number> {
  // Base gas cost for a transaction
  const baseGas = 21000;
  
  // Estimate additional gas per swap
  const additionalGasPerSwap = 120000;
  
  // Calculate total gas based on the number of swaps (path.length - 1)
  return baseGas + (additionalGasPerSwap * (path.length - 1));
}

export async function getGasCostInToken({
  provider,
  token,
  gasUnits,
}: {
  provider: ethers.providers.Provider;
  token: TokenInfo;
  gasUnits: number;
}): Promise<bigint> {
  const gasPrice = await provider.getGasPrice();
  const gasCostEth = gasPrice.mul(gasUnits);
  
  if (token.symbol.toUpperCase() === "ETH" || token.symbol.toUpperCase() === "WETH") {
    return BigInt(gasCostEth.toString());
  }
  
  // Get prices using real DEX quotes
  const ethPrice = await getTokenPrice({ symbol: "WETH", address: WETH_ADDRESS, decimals: 18 });
  const tokenPrice = await getTokenPrice(token);
  
  if (tokenPrice === 0) {
    return BigInt(0); // Avoid division by zero
  }
  
  // Convert ETH cost to token cost
  const gasCostEthNumber = Number(ethers.utils.formatEther(gasCostEth));
  const gasCostTokenNumber = gasCostEthNumber / tokenPrice;
  
  // Convert to BigInt with proper decimals
  return BigInt(Math.floor(gasCostTokenNumber * 10 ** token.decimals));
}
