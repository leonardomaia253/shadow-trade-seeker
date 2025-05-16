
import { ethers } from "ethers";
import { BigNumberish } from "ethers";

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
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
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

export type Call = {
  to: string;          // endereço do contrato a ser chamado
  data: string;        // calldata da função
  value?: bigint;      // ETH enviado junto, se necessário
};

interface PoolData {
  router: string;
}

export type SwapStep = {
  dex: string;               // Nome do DEX, ex: "uniswapv3"
  tokenIn: string;           // Endereço do token de entrada
  tokenOut: string;          // Endereço do token de saída
  amountIn: bigint;
  amountOut: bigint;          // Quantidade de entrada
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
  // Pode adicionar outros campos do ethers.providers.TransactionRequest se desejar
}