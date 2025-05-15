
// Tenderly configuration for simulations
export const TENDERLY_CONFIG = {
  account: "Volup"
  project: "project1",           // Replace in production
  accessKey: process.env.TENDERLY_ACCESS_KEY || "your-tenderly-key", // Replace in production
};

// Flashbots configuration
export const FLASHBOTS_CONFIG = {
  relaySigner: process.env.FLASHBOTS_RELAY_SIGNER || "0x",
  authSigner: process.env.FLASHBOTS_AUTH_SIGNER || "0x",
  relayEndpoint: "https://relay.flashbots.net"
};

// MEV-Share configuration 
export const MEV_SHARE_CONFIG = {
  endpoint: "https://mev-share.flashbots.net",
  authSigner: process.env.MEV_SHARE_AUTH_SIGNER || "0x"
};

// Network configuration
export const ARBITRUM_CONFIG = {
  chainId: 42161,
  blockTime: 0.25, // in seconds
  defaultGasMultiplier: 1.2,
  maxGasPriceGwei: 30
};
