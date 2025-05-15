import { BigNumber } from "ethers";
import { ethers } from "ethers";

// Existente ou novo arquivo de tipos

// DEX types
export type DexType = 
  | 'uniswapv2'
  | 'uniswapv3'
  | 'uniswapv4'
  | 'sushiswap_v2'
  | 'sushiswap_v3'
  | 'pancakeswapv3'
  | 'ramsesv2'
  | 'maverickv2'
  | 'camelot'
  | 'curve'
  | string;


export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  name?: string;
  price?: number;
}

export interface DexSwap {
  dex: string;
  target: string;
  callData: string;
  approveToken: string;
  amountIn: BigNumber;
  amountOutMin?: BigNumber;
  tokenIn: string;
  tokenOut: string;
  amountOut: bigint;
  poolId?: string;
  tokenInIndex?: string;
  tokenOutIndex?: string;
  fee?: number;
  flashloanProvider?: string;
  recipient: string;
}


export interface CallData {
  target: string;
  approveToken?: string;
  requiresApproval?: boolean;
  approvalToken?: string;
  approvalAmount?: string;
  dex: DexType;
  callData: string; // Calldata codificado (a ser enviado para a blockchain)
  value?: BigNumber; // ETH enviado junto, se necessário
  metadata?: {
  tokenIn: string;
  tokenOut: string;
  amountIn: Number;
  amountOutMin: Number;
  expectedAmountOut?: Number;
  path?: string[];
  deadline?: number;
  fee?: number | number[];
  i?: number;
  j?: number;
  pool?: string;
  bins?: string[];
  kind?: number;
  stable?: boolean;
  route?: {
  tokenIn: string;
  tokenOut: string;
  stable: boolean;
      };
      [key: string]: any;
    };
  }

  //---------------------------------------------------- Tipagem para oportunidades--------------------------------------------

export interface FrontrunOpportunity {
  dex: | 'uniswapv2' | 'uniswapv3' | 'uniswapv4' | 'sushiswap_v2' | 'sushiswap_v3' | 'pancakeswapv3' | 'ramsesv2' | 'maverickv2' | 'camelot' | 'curve';
  tx: any;
  victimInput: string;
  victimOutput: string;
  victimTxHash: string;
  profit: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  estimatedProfit: bigint;
  estimatedProfitUsd: number;
  timestamp: number;
}

export interface SandwichOpportunity {
  dex: | 'uniswapv2' | 'uniswapv3' | 'uniswapv4' | 'sushiswapv2' | 'sushiswapv3' | 'pancakeswapv3' | 'ramsesv2' | 'maverickv2' | 'camelot' | 'curve';
  tx: any;
  victimInput: string;
  victimOutput: string;
  victimTxHash: string;
  profit: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  estimatedProfit: bigint;
  estimatedProfitUsd: number;
  timestamp: number;
}

export interface LiquidationOpportunity {
  protocol: "aave" | "radiant" | "compound" | "morpho" | "abracadabra" | "spark";
  userAddress: string;
  user?: string;
  healthFactor: number;
  collateralAsset: TokenInfo;
  debtAsset: TokenInfo;
  collateralAmount: ethers.BigNumber;
  debtAmount: ethers.BigNumber;
  estimatedProfitUsd: number;
  liquidationBonus: number;
  liquidationThreshold?: number;
  returnToken?: string;
  estimatedReturnAmount?: BigNumber;
}

export interface ArbitrageOpportunity {
  dex: | 'uniswapv2' | 'uniswapv3' | 'uniswapv4' | 'sushiswapv2' | 'sushiswapv3' | 'pancakeswapv3' | 'ramsesv2' | 'maverickv2' | 'camelot' | 'curve';
  tokenIn: string;
  tokenOut: string;
  path: DexSwap[];
  profit: bigint;
}

//-----------------------------------------------------------------------------------------------------------------------------------------

export interface QuoteResult {
  amountIn: bigint;
  amountOut: bigint;
  path: TokenInfo[];
  dex: string;
}

// Adding missing ArbitrageRoute interface
export interface ArbitrageRoute {
  path: TokenInfo[];
  quote: QuoteResult;
  netProfit: bigint;
  gasCost: bigint;
  dex:string;
}

// Interfaces para logging
export interface OpportunityLog {
  botType: 'arbitrage' | 'sandwich' | 'liquidation' | 'frontrun' | "profiterone" | "profitertwo";
  opportunityType: string;
  timestamp: number;
  details: any;
  estimatedProfitUsd: number;
  executionDecision: 'accepted' | 'rejected';
  decisionReason?: string;
}

export interface SimulationLog {
  botType: 'arbitrage' | 'sandwich' | 'liquidation' | 'frontrun' | "profiterone" | "profitertwo";
  timestamp: number;
  gasUsed: number;
  success: boolean;
  profitDelta?: string;
  error?: string;
  simulationUrl?: string;
  balanceChanges?: any;
}

export interface BundleSubmissionLog {
  botType: 'arbitrage' | 'sandwich' | 'liquidation' | 'frontrun' | "profiterone" | "profitertwo";
  timestamp: number;
  blockNumber: number;
  relays: string[];
  successful: string[];
  failed: string[];
  error?: string;
  transactionHash?: string;
}

export interface ExecutionResultLog {
  botType: 'arbitrage' | 'sandwich' | 'liquidation' | 'frontrun' | "profiterone" | "profitertwo";
  timestamp: number;
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  actualProfitUsd?: number;
  expectedProfitUsd?: number;
  error?: string;
}

// Interface para estatísticas dos bots
export interface BotExecutionStats {
  botType: 'arbitrage' | 'sandwich' | 'liquidation' | 'frontrun' | "profiterone" | "profitertwo";
  opportunitiesDetected: number;
  opportunitiesExecuted: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfitUsd: number;
  averageProfitUsd: number;
  highestProfitUsd: number;
  totalGasUsed: number;
  lastExecution?: number;
  lastSuccess?: number;
}

export interface QuoteResult {
  amountOutMin: BigNumber;
  estimatedGas: BigNumber;
  amountOutInETH?: BigNumber;
 // opcional: estimativa convertida via oracle ou rota
}

export interface Position {
  protocol: "aave-v2" | "aave-v3" | "compound" | "morpho" | "venus" | "spark";
  user: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  debtToken?: string;
  collateralToken?: string;
  debtAmount?: string;
  estimatedProfitUsd?: number;
}

export interface SwapCallParams {
  tokenIn: string;
  tokenOut: string;
  amountIn?: string | BigNumber;
  slippage?: number;
  dex?: DexType;
  deadline?: number;
}

export interface BuiltSwapCall {
  target: string;
  callData: string;
  approveToken: string;
}


export interface BuiltRoute {
  path?: string[];
  swaps: DexSwap[];
  inputToken?: string;
  outputToken?: string;
  expectedOutput?: BigNumber;
  flashloanProvider?: string;
  flashloanAmount?: BigNumber;
  estimatedProfit?: BigNumber;
  estimatedGas?: BigNumber;
  calls: CallData[];
  tokenIn?: string;
  tokenOut?: string;
}

// Bundle and transaction types
export interface BundleTransaction {
  signedTransaction: string;
  hash?: string;
  account?: string;
}

export interface BundleSendResult {
  success: boolean;
  txHash?: string;
  error?: string;
  bundleHash?: string;
  blockNumber?: number;
}


export interface LiquidationExecutionResult {
  protocol: string;
  opportunity: LiquidationOpportunity;
  txHash: string;
  profitUsd: number;
  timestamp: number;
  dryRun: boolean;
  success: boolean;
}

// Simulation types
export interface SimulationResult {
  success: boolean;
  ok: boolean;
  profits: ethers.BigNumber;
  simulationUrl: string;
  error?: string;
}

// Logging types
export interface LogMetadata {
  botType?: string;
  source?: string;
  component?: string;
  data?: any;
  metadata?: Record<string, any>;
  dex?: string;
  txData?: string;
  originalTxHash?: string;
  tokenA?: string;
  tokenB?: string;
  error?: any;
  category?: string;
}

// Decoded tx types
export interface DecodedSwapTransaction {
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOutMin: ethers.BigNumber;
  path?: string[];
  recipient?: string;
  deadline?: number;
  signature?: string;
  dex?: string;
}

export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  signer: ethers.Signer;
  dex: DexType;
  amountOutMin?: BigNumber;
  slippage?: number;
  deadline?: number;
  path?: string[]; // Para UniswapV2/V3, Sushi, Camelot
  fee?: number | number[]; // Para UniswapV3, PancakeSwap V3
  pool?: string; // Para Curve
  i?: number; // Para Curve
  j?: number; // Para Curve
  bins?: string[]; // Para Maverick
  kind?: number; // Para Maverick
  stable?: boolean; // Para Ramses
  route?: {
  tokenIn: string;
  tokenOut: string;
  stable: boolean;
    }; // Para Ramses V2
    extra?: Record<string, any>; // Campo genérico extensível
  }