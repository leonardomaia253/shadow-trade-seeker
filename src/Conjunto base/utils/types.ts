
import { ethers } from "ethers";
import { DexType } from "./types";

// Define types used throughout the application
export type DexType = 
  | "uniswapv2" 
  | "uniswapv3" 
  | "uniswapv4"
  | "sushiswapv2"
  | "sushiswapv3"
  | "pancakeswapv3"
  | "maverickv2"
  | "ramsesv2"
  | "curve"
  | "camelot";

// Token information
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
}

// Call data for contract interactions
export interface CallData {
  target: string;
  callData: string;
  dex: DexType;
  value?: ethers.BigNumberish;
  requiresApproval: boolean;
  approvalToken: string;
  approvalAmount: ethers.BigNumberish;
}

// Arbitrage route
export interface ArbitrageRoute {
  path: TokenInfo[];
  dexes?: DexType[];
  netProfit: ethers.BigNumberish;
}

// Quote result from DEX
export interface QuoteResult {
  amountIn: ethers.BigNumberish;
  amountOut: ethers.BigNumberish;
  amountOutMin: ethers.BigNumberish;
  estimatedGas: ethers.BigNumberish;
  path: TokenInfo[];
  dex: string;
}

// Frontrun opportunity
export interface FrontrunOpportunity {
  hash: string;
  dex: DexType;
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumberish;
  deadline: number;
  probability: number;
  estimatedProfitUsd?: number;
}

// Liquidation opportunity
export interface LiquidationOpportunity {
  protocol: string;
  userAddress: string;
  collateralAsset: string | TokenInfo;
  debtAsset: string | TokenInfo;
  debtAmount: string | ethers.BigNumberish;
  healthFactor: number;
  estimatedProfitUsd: number;
  timestamp: number;
}

// Built route for arbitrage execution
export interface BuiltRoute {
  swaps: Array<{
    target: string;
    callData: string;
    approveToken: string;
    amountIn: ethers.BigNumber;
    flashloanProvider: string;
  }>;
  profitUSD: number;
}

// Log metadata for enhanced logging
export interface LogMetadata {
  [key: string]: any;
}
