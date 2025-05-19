// utils/uniswapV4Utils.ts
import { BigNumber, Contract } from 'ethers';
import { provider } from '../../config/provider';


export const UNISWAP_V4_POOL_MANAGER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "int256", "name": "amountSpecified", "type": "int256" },
          { "internalType": "bool", "name": "zeroForOne", "type": "bool" },
          { "internalType": "bytes", "name": "path", "type": "bytes" }
        ],
        "internalType": "struct IPoolManager.SwapParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "simulateSwap",
    "outputs": [
      { "internalType": "int256", "name": "amountOut", "type": "int256" },
      { "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
      { "internalType": "uint32", "name": "tickAfter", "type": "uint32" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


const UNISWAP_V4_POOL_MANAGER = '0x4200000000000000000000000000000000000002'; // Exemplo: Arbitrum

const poolManager = new Contract(UNISWAP_V4_POOL_MANAGER, UNISWAP_V4_POOL_MANAGER_ABI, provider);

export async function getQuoteUniswapV4(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  try {
    const path = encodePath([from, to], [3000]); // taxa fixa por enquanto
    const result = await poolManager.callStatic.simulateSwap({
      recipient: '0x0000000000000000000000000000000000000000', // dummy
      amountSpecified: amountIn,
      zeroForOne: true,
      path,
    });
    return result.amountOut;
  } catch {
    return BigNumber.from(0);
  }
}

export function encodePath(tokens: string[], fees: number[]): string {
  if (tokens.length !== fees.length + 1) throw new Error("Invalid path");

  let encoded = '0x';
  for (let i = 0; i < fees.length; i++) {
    encoded += tokens[i].slice(2).toLowerCase(); // 20 bytes
    encoded += fees[i].toString(16).padStart(6, '0'); // 3 bytes
  }
  encoded += tokens[tokens.length - 1].slice(2).toLowerCase();
  return encoded;
}