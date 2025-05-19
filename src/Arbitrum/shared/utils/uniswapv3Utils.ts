import { ethers, BigNumber, Contract } from 'ethers';
import { provider } from '../../config/provider'; // seu provider ethers

// ENDEREÇOS principais da Uniswap V3 na Ethereum mainnet (ajuste para sua rede se precisar)
const UNISWAP_V3_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const UNISWAP_V3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// ABI simplificado do Quoter Uniswap V3 (para quoteExactInputSingle)
const UNISWAP_V3_QUOTER_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "tokenIn", "type": "address" },
      { "internalType": "address", "name": "tokenOut", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" },
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
    ],
    "name": "quoteExactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ABI simplificado do Router Uniswap V3 (para swap ex)
// Pode estender conforme a necessidade, aqui só exemplo básico
const UNISWAP_V3_ROUTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
          { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Instancia os contratos
export const quoterContract = new Contract(
  UNISWAP_V3_QUOTER_ADDRESS,
  UNISWAP_V3_QUOTER_ABI,
  provider
);

export const routerContract = new Contract(
  UNISWAP_V3_ROUTER_ADDRESS,
  UNISWAP_V3_ROUTER_ABI,
  provider
);

// Função para obter a cotação estimada no Uniswap V3
export async function getQuoteUniswapV3(
  from: string,
  to: string,
  amountIn: BigNumber,
  fee: number = 3000 // padrão 0.3%
): Promise<BigNumber> {
  if (from.toLowerCase() === to.toLowerCase()) {
    return amountIn;
  }
  try {
    // sqrtPriceLimitX96 = 0 para sem limite
    const amountOut = await quoterContract.quoteExactInputSingle(
      from,
      to,
      fee,
      amountIn,
      0
    );
    return amountOut as BigNumber;
  } catch (err) {
    console.error('Erro no getQuoteUniswapV3:', err);
    return BigNumber.from(0);
  }
}
