import { BigNumber } from 'ethers';
import { Contract } from 'ethers';
import { provider } from '../../config/provider';

export const SUSHISWAP_V3_QUOTER_ADDRESS = '0x2D99A...';

export const SUSHISWAP_V3_QUOTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' }
    ],
    name: 'quoteExactInputSingle',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];

export const sushiswapQuoter = new Contract(
  SUSHISWAP_V3_QUOTER_ADDRESS,
  SUSHISWAP_V3_QUOTER_ABI,
  provider
);


export async function getQuoteSushiswapV3(
  from: string,
  to: string,
  amountIn: BigNumber
): Promise<BigNumber> {
  try {
    if (from.toLowerCase() === to.toLowerCase()) return amountIn;
    return await sushiswapQuoter.quoteExactInputSingle(from, to, 3000, amountIn, 0);
  } catch {
    return BigNumber.from(0);
  }
}
