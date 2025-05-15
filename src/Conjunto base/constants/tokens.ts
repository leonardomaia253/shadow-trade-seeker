
// Token addresses for the Arbitrum network
export const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
export const USDC = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
export const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
export const DAI = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
export const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
export const ARB = "0x912CE59144191C1204E64559FE8253a0e49E6548";
export const GMX = "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a";
export const LINK = "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4";

// Token details including decimals and other metadata
export const TOKEN_DETAILS = {
  [WETH]: {
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png"
  },
  [USDC]: {
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png"
  },
  [USDT]: {
    symbol: "USDT",
    decimals: 6,
    name: "Tether USD",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png"
  },
  [DAI]: {
    symbol: "DAI",
    decimals: 18,
    name: "Dai Stablecoin",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png"
  },
  [WBTC]: {
    symbol: "WBTC",
    decimals: 8,
    name: "Wrapped Bitcoin",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png"
  },
  [ARB]: {
    symbol: "ARB",
    decimals: 18,
    name: "Arbitrum",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png"
  },
  [GMX]: {
    symbol: "GMX",
    decimals: 18,
    name: "GMX",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a/logo.png"
  },
  [LINK]: {
    symbol: "LINK",
    decimals: 18,
    name: "Chainlink",
    logoURI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png"
  }
};

// Most liquid tokens in the network (to use for arbitrage)
export const LIQUID_TOKENS = [
  WETH,
  USDC,
  USDT,
  DAI,
  WBTC,
  ARB,
  GMX,
  LINK
];

// Common token pairs for price monitoring
export const COMMON_PAIRS = [
  { base: WETH, quote: USDC },
  { base: WETH, quote: USDT },
  { base: WBTC, quote: WETH },
  { base: WBTC, quote: USDC },
  { base: ARB, quote: USDC },
  { base: ARB, quote: WETH },
  { base: GMX, quote: WETH },
  { base: LINK, quote: USDC }
];

// Helper function to get token details
export function getTokenDetails(address: string) {
  const lowerCaseAddress = address.toLowerCase();
  // Find matching token by case-insensitive address
  for (const [tokenAddress, details] of Object.entries(TOKEN_DETAILS)) {
    if (tokenAddress.toLowerCase() === lowerCaseAddress) {
      return {
        address: tokenAddress,
        ...details
      };
    }
  }
  return null;
}
