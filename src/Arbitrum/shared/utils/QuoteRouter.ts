// utils/quoteRouter.ts
import { BigNumber } from 'ethers';

import { getQuoteUniswapV2 } from './uniswapv2Utils';
import { getQuoteUniswapV3 } from './uniswapv3Utils';
import { getQuoteUniswapV4 } from './uniswapv4Utils';
import { getQuoteSushiswapV2 } from './sushiswapv2Utils';
import { getQuoteSushiswapV3 } from './sushiswapv3Utils';
import { getQuoteCamelot } from './camelotUtils';
import { getQuoteCurve } from './curveUtils';
import { getQuoteRamsesV2 } from './ramsesv2Utils';
import { getQuoteMaverickV2 } from './maverickv2utils';
import { getQuotePancakeSwapV3 } from './pancakev3swapUtils';

export const DEX_LIST_PRIORITY = [
   "uniswapv3",
  "uniswapv2",
  "sushiswapv3",
  "sushiswapv2",
  "camelot",
  "pancakeswapv3",
  "maverickv2",
  "ramsesv2",
  "uniswapv4",
  "curve",
] as const;

export type DEX = typeof DEX_LIST_PRIORITY[number];

export async function estimateSwapOutput(
  from: string,
  to: string,
  amountIn: BigNumber,
  dex: string,
): Promise<BigNumber> {
  switch (dex) {
    case 'uniswapv2':
      return getQuoteUniswapV2(from, to, amountIn);
    case 'uniswapv3':
      return getQuoteUniswapV3(from, to, amountIn);
    case 'uniswapv4':
      return getQuoteUniswapV4(from, to, amountIn);
    case 'sushiswapv2':
      return getQuoteSushiswapV2(from, to, amountIn);
    case 'sushiswapv3':
      return getQuoteSushiswapV3(from, to, amountIn);
    case 'camelot':
      return getQuoteCamelot(from, to, amountIn);
    case 'curve':
      return getQuoteCurve(from, to, amountIn);
    case 'ramsesv2':
      return getQuoteRamsesV2(from, to, amountIn);
    case 'maverickv2':
      return getQuoteMaverickV2(from, to, amountIn);
    case 'pancakeswapv3':
      return getQuotePancakeSwapV3(from, to, amountIn);
    default:
      return BigNumber.from(0);
  }
}