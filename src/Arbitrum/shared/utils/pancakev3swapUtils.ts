// utils/pancakeQuoter.ts
import { Contract } from 'ethers';
import { provider } from '../../config/provider';
import { BigNumber } from 'ethers';


const PANCAKE_QUOTER_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'; // PancakeSwap V3 Quoter

const PANCAKE_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
];

export const pancakeQuoter = new Contract(
  PANCAKE_QUOTER_ADDRESS,
  PANCAKE_QUOTER_ABI,
  provider
);

export async function getQuotePancakeSwapV3(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  try {
    // Fee tier comum 3000 = 0.3%
    return await pancakeQuoter.quoteExactInputSingle(from, to, 3000, amountIn, 0);
  } catch {
    return BigNumber.from(0);
  }
}