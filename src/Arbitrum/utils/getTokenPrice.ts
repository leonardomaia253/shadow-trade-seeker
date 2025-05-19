
import { ethers } from "ethers";
import axios from "axios";
import { LRUCache } from "lru-cache";

// ERC20 Interface for token decimals
const erc20Interface = new ethers.utils.Interface([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
]);

// Cache for token prices to reduce API calls
const priceCache = new LRUCache<string, {price: number, timestamp: number}>({
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 5, // Time to live: 5 minutes
});

// Cache for token decimals to avoid repeated contract calls
const decimalsCache = new LRUCache<string, number>({
  max: 200,
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Get token price in ETH using multiple sources
 * @param tokenAddress - Token contract address
 * @param provider - Ethers provider
 * @returns Price in ETH
 */
export async function getTokenPrice(
  tokenAddress: string,
  provider: ethers.providers.Provider
): Promise<number> {
  // Normalize address
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // If token is WETH, return 1
  if (
    normalizedAddress === "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" || // Arbitrum WETH
    normalizedAddress === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"    // Mainnet WETH
  ) {
    return 1;
  }
  
  // Check cache first
  const cachedPrice = priceCache.get(normalizedAddress);
  if (cachedPrice && Date.now() - cachedPrice.timestamp < 1000 * 60 * 5) { // Valid for 5 minutes
    return cachedPrice.price;
  }
  
  try {
    // Try to fetch from CoinGecko API first
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/arbitrum-one?contract_addresses=${normalizedAddress}&vs_currencies=eth`,
        { timeout: 3000 } // 3 second timeout
      );
      
      if (response.data && response.data[normalizedAddress] && response.data[normalizedAddress].eth) {
        const price = response.data[normalizedAddress].eth;
        priceCache.set(normalizedAddress, { price, timestamp: Date.now() });
        return price;
      }
    } catch (e) {
      console.log(`CoinGecko API error for ${normalizedAddress}:`, e.message);
    }
    
    // Fallback to DEX price via 1inch API
    try {
      const wethAddress = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // Arbitrum WETH
      const response = await axios.get(
        `https://api.1inch.io/v5.0/42161/quote?fromTokenAddress=${normalizedAddress}&toTokenAddress=${wethAddress}&amount=1000000000000000000`,
        { timeout: 3000 }
      );
      
      if (response.data && response.data.toTokenAmount) {
        // Get token decimals if not cached
        let decimals = decimalsCache.get(normalizedAddress);
        if (decimals === undefined) {
          try {
            const contract = new ethers.Contract(normalizedAddress, erc20Interface, provider);
            decimals = await contract.decimals();
            decimalsCache.set(normalizedAddress, decimals);
          } catch (e) {
            console.error(`Error getting decimals for ${normalizedAddress}:`, e);
            decimals = 18; // Default to 18 if unable to fetch
          }
        }
        
        const normalizedAmount = ethers.utils.parseUnits("1", decimals);
        const price = Number(ethers.utils.formatEther(response.data.toTokenAmount)) / 
                     Number(ethers.utils.formatUnits(normalizedAmount.toString(), decimals));
                     
        priceCache.set(normalizedAddress, { price, timestamp: Date.now() });
        return price;
      }
    } catch (e) {
      console.log(`1inch API error for ${normalizedAddress}:`, e.message);
    }
    
    // Last resort: Try SushiSwap subgraph
    try {
      const query = `
        {
          token(id: "${normalizedAddress}") {
            derivedETH
          }
        }
      `;
      
      const response = await axios.post(
        'https://api.thegraph.com/subgraphs/name/sushiswap/arbitrum-exchange',
        { query },
        { timeout: 3000 }
      );
      
      if (response.data && 
          response.data.data && 
          response.data.data.token && 
          response.data.data.token.derivedETH) {
        const price = parseFloat(response.data.data.token.derivedETH);
        priceCache.set(normalizedAddress, { price, timestamp: Date.now() });
        return price;
      }
    } catch (e) {
      console.log(`SushiSwap subgraph error for ${normalizedAddress}:`, e.message);
    }
    
    // If all methods fail, return 0
    console.error(`Failed to fetch price for ${normalizedAddress} from all sources`);
    return 0;
  } catch (error) {
    console.error(`Error in getTokenPrice for ${normalizedAddress}:`, error);
    return 0;
  }
}

/**
 * Get the value of a token amount in ETH
 * @param tokenAddress Token contract address
 * @param amount Amount in token's smallest unit (wei)
 * @param provider Ethers provider
 * @returns Value in ETH
 */
export async function getTokenValueInETH(
  tokenAddress: string,
  amount: ethers.BigNumberish,
  provider: ethers.providers.Provider
): Promise<ethers.BigNumber> {
  try {
    // Get token decimals if not cached
    let decimals = decimalsCache.get(tokenAddress.toLowerCase());
    if (decimals === undefined) {
      try {
        const contract = new ethers.Contract(tokenAddress, erc20Interface, provider);
        decimals = await contract.decimals();
        decimalsCache.set(tokenAddress.toLowerCase(), decimals);
      } catch (e) {
        console.error(`Error getting decimals for ${tokenAddress}:`, e);
        decimals = 18; // Default to 18 if unable to fetch
      }
    }
    
    // Get token price
    const price = await getTokenPrice(tokenAddress, provider);
    
    // Calculate value in ETH
    const amountInEth = ethers.utils.formatUnits(amount, decimals);
    const valueInEth = parseFloat(amountInEth) * price;
    
    return ethers.utils.parseEther(valueInEth.toString());
  } catch (error) {
    console.error(`Error in getTokenValueInETH:`, error);
    return ethers.BigNumber.from(0);
  }
}

// Export a named function for backward compatibility
export async function getTokenPriceInETH(tokenAddress: string, provider: ethers.providers.Provider): Promise<number> {
  return getTokenPrice(tokenAddress, provider);
}
