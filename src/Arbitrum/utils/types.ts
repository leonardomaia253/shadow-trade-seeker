
import { ethers } from "ethers";
import { BigNumberish } from "ethers";
import { BigNumber } from "ethers";
import { Signer } from "ethers";; // ou ajuste conforme a estrutura do seu projeto

export type BuildOrchestrationParams = {
  route?: SwapStep[];              // Rota principal de swaps
  executor: string;               // Endereço do contrato executor
  useAltToken?: boolean;           // Se usará token alternativo (ex: WETH)
  altToken?: string;               // Token alternativo a ser usado (ex: WETH)
  preSwapDex?: string;            // DEX usado para altToken → tokenIn (se usar altToken)
  postSwapDex?: string;           // DEX usado para tokenOut → altToken (se usar altToken)
};

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

  export type ProtocolType = 
  | "aave" 
  | "spark" 
  | "radiant"
  | "abracadabra"
  | "venus"
  | "compound"
  | "morpho"
  | "llamalend"
  | "creamfinance"
  | "ironbank";


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
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
  dex?: DexType;
  amountOutMin?: BigNumber;
  value?: ethers.BigNumberish;
  requiresApproval?: boolean;
  approvalToken?: string;
  approvalAmount?: ethers.BigNumberish;
  target?: string;     // compatibility with older code
  callData?: string;   // compatibility with older code
}

// Simulation result type
export interface SimulationResult {
  success: boolean;
  ok: boolean;
  profits: ethers.BigNumber;
  simulationUrl: string;
  error?: string;
}

// Arbitrage route
export interface ArbitrageRoute {
  path: TokenInfo[];
  dexes?: DexType[];
  netProfit: ethers.BigNumberish;
  quote: string;
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
  collateralAsset: string | { address: string, symbol?: string, decimals?: number };
  debtAsset: string | { address: string, symbol?: string, decimals?: number };
  collateralAmount?: string | number;
  debtAmount?: string | number;
  healthFactor?: number;
  expectedProfit?: number;
  collateral?: Array<{ token: string, amount: number }>;
  debt?: Array<{ token: string, amount: number }>;
}

// Account Health Data for Liquidation
export interface AccountHealthData {
  user: string;
  healthFactor: number;
  totalCollateralETH: number;
  totalDebtETH: number;
  collateral: Array<{ token: string, amount: number }>;
  debt: Array<{ token: string, amount: number }>;
}

// Liquidation Bundle Parameters
export interface LiquidationBundleParams {
  protocol: string;
  params: any;
  fromToken?: string;
  toToken?: string;
}

// Built route for arbitrage execution
export interface BuiltRoute {
  swaps: Array<{
    target: string;
    callData: string;
    approveToken: string;
    amountIn: ethers.BigNumber;
    flashloanProvider: string;
    tokenIn?: string;
    tokenOut?: string;
  }>;
  profitUSD: number;
  calls?: Call[];
}

// DexSwap information
export type DexSwap = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  amountOutMin?: BigNumber;
  slippage?: number;
  callbackRecipient?: string;
  sqrtPriceLimitX96?: number;
  dex: DexType;
  recipient: string;
  flashLoanToken?: string;
  flashLoanAmount?: BigNumber;
};


// Built Swap Call
export interface BuiltSwapCall {
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
  value?: ethers.BigNumber;  
}

// Log metadata for enhanced logging
export interface LogMetadata {
  [key: string]: any;
}

export type Call = {
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
  value?: bigint;      // ETH enviado junto, se necessário
  target?: string;     // Compatibilidade com outros formatos
};

interface PoolData {
  router: string;
}

export type SwapStep = {
  dex: string;               // Nome do DEX, ex: "uniswapv3"
  tokenIn: string;           // Endereço do token de entrada
  tokenOut: string;          // Endereço do token de saída
  amountIn: BigNumber;
  amountOut: BigNumber;          // Quantidade de entrada
  amountOutMin?: bigint;     // Quantidade mínima de saída esperada
  path?: string[];           // Caminho (usado por alguns DEXs como Uniswap V2/V3)
  extra?: any; 
  router:string;  
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
  value?: bigint; 
  poolData?: PoolData | string;           // Campo opcional para parâmetros específicos (ex: fee tiers da Uniswap V3)
};

export interface MyTransactionRequest {
  to: string; // endereço destino da transação
  data: string; // calldata hex string
  value?: BigNumberish; // valor enviado em wei (opcional)
  gasLimit?: BigNumberish; // limite de gás (opcional)
  nonce?: number; // nonce da transação (opcional)
  gasPrice?: BigNumberish; // preço do gás (opcional)
  maxFeePerGas?: BigNumberish; // EIP-1559 max fee per gas (opcional)
  maxPriorityFeePerGas?: BigNumberish; // EIP-1559 max priority fee (opcional)
}

// Used for transaction decoding
export interface DecodedSwapTransaction {
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOutMin: ethers.BigNumber;
  to?: string;
  path?: string[];
  deadline?: number;
  dex: DexType;
  recipient: string;
}

export type BasicSwapStep = {
  dex: string;
  tokenIn: string;
  tokenOut: string;
  amountIn?: BigNumber;
  amountOut?: BigNumber;
  poolData?: any;
  calls?: Call[];
};
