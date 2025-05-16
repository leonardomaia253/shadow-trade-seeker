
/**
 * Contratos principais utilizados pelos bots
 */
export const EXECUTOR_CONTRACTARBITRUM = "0xebc996030ad65e113ba2f03e55de080044b83dca"; 
export const EXECUTOR_CONTRACTAVALANCHE = ""; 
export const EXECUTOR_CONTRACTBASE = ""; 
export const EXECUTOR_CONTRACTBINANCE = ""; 
export const EXECUTOR_CONTRACTETHEREUM = ""; 
export const EXECUTOR_CONTRACTOPTIMISM = ""; 
export const EXECUTOR_CONTRACTPOLYGON = ""; 

/**
 * Contratos de provedores de flashloans
 */
export const FLASHLOAN_CONTRACTS = {
  AAVE_V2: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  AAVE_V3: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Pool de lending da Aave V3 no Arbitrum
  BALANCER: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Vault do Balancer no Arbitrum
  UNISWAP_V3: "0x1F98431c8aD98523631AE4a59f267346ea31F984" // Factory do Uniswap V3 no Arbitrum
};

/**
 * Contratos de oracle
 */
export const PRICE_ORACLE_CONTRACTS = {
  CHAINLINK: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // Feed Registry no Arbitrum
  UNISWAP_V3: "0x1F98431c8aD98523631AE4a59f267346ea31F984" // Factory do Uniswap V3 no Arbitrum
};

/**
 * Contratos de liquidação
 */
export const LIQUIDATION_CONTRACTS = {
  AAVE_V3: {
    POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Pool da Aave V3 no Arbitrum
    DATA_PROVIDER: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654", // Data Provider da Aave V3 no Arbitrum
    ORACLE: "0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7", // Price Oracle da Aave V3 no Arbitrum
  },
  COMPOUND_V3: {
    COMPTROLLER: "0xbEe9Cf658702527b158E7BfEC7Fe0a4259A6aAf1", // Compound V3 no Arbitrum
    ORACLE: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // Price Oracle do Compound V3 no Arbitrum
  }
};
