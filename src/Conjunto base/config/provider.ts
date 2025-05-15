import { ethers } from "ethers";

// RPC Endpoints
const RPC_URLS = {
  mainnet: process.env.ETH_MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
  arbitrum: process.env.ARBITRUM_RPC_URL || "https://arb-mainnet.g.alchemy.com/v2/demo",
  optimism: process.env.OPTIMISM_RPC_URL || "https://opt-mainnet.g.alchemy.com/v2/demo",
  polygon: process.env.POLYGON_RPC_URL || "https://polygon-mainnet.g.alchemy.com/v2/demo",
  avalanche: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
  bsc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org"
};

export const provider = new ethers.providers.JsonRpcProvider(RPC_URLS.arbitrum);

const WSS_URLS = {
  mainnet: process.env.ETH_MAINNET_RPC_URL || "wss://eth-mainnet.g.alchemy.com/v2/demo",
  arbitrum: process.env.ARBITRUM_RPC_URL || "wss://arb-mainnet.g.alchemy.com/v2/demo",
  optimism: process.env.OPTIMISM_RPC_URL || "wss://opt-mainnet.g.alchemy.com/v2/demo",
  polygon: process.env.POLYGON_RPC_URL || "wss://polygon-mainnet.g.alchemy.com/v2/demo",
  avalanche: process.env.AVALANCHE_RPC_URL || "wss://api.avax.network/ext/bc/C/rpc",
  bsc: process.env.BSC_RPC_URL || "wss://polygon-mainnet.g.alchemy.com/v2/demo",
  base: process.env.BASE_RPC_URL || "wss://base-mainnet.g.alchemy.com/v2/demo"
};

export const wsProvider = WSS_URLS.arbitrum 
  ? new ethers.providers.WebSocketProvider(WSS_URLS.arbitrum) 
  : null;


// Create a wallet - in production this would use environment variables
const PRIVATE_KEY = "0x406769da0204de94ad7bf22a4edb240a85b223dfbb884023e5ce423453f7be7c"; // Replace with actual private key in production
export const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

export const getProvider = () => provider;
export const getWsProvider = () => wsProvider;
export const getSigner = () => wallet;


