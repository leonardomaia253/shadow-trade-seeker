import { ethers } from "ethers";
import { CallData, DexSwap, BuiltSwapCall, DexType } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { BigNumber } from "ethers";

// Importa os builders individuais
import {
  buildUniswapV2Swap,
  buildUniswapV3Swap,
  buildUniswapV4Swap,
  buildSushiswapV2Swap,
  buildSushiswapV3Swap,
  buildPancakeswapV3Swap,
  buildCamelotSwap,
  buildMaverickV2Swap,
  buildRamsesV2Swap,
  buildCurveSwap
} from "../../utils/encodeSwap";



export async function buildSwapTransaction({
  tokenIn,
  amountIn,
  tokenOut,
  amountOutMin,
  dex,
  recipient,
}: {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  amountOutMin: BigNumber;
  dex: DexType;
  recipient: string;
}): Promise<BuiltSwapCall> {
  if (dex === 'uniswapv2') {
    return buildUniswapV2Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient});
  } else if (dex === 'uniswapv3') {
    return buildUniswapV3Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'uniswapv4') {
    return buildUniswapV4Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'sushiswapv2') {
    return buildSushiswapV2Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'sushiswapv3') {
    return buildSushiswapV3Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'pancakeswapv3') {
    return buildPancakeswapV3Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'curve') {
    return buildCurveSwap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'camelot') {
    return buildCamelotSwap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient});
  } else if (dex === 'maverickv2') {
    return buildMaverickV2Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient });
  } else if (dex === 'ramsesv2') {
    return buildRamsesV2Swap({ tokenIn, tokenOut, amountIn, amountOutMin, dex, recipient});
  } else {
    throw new Error(`DEX '${dex}' não suportada`);
  }
}
