import { DexSwap, BuiltSwapCall } from "./types";
import { ethers,BigNumber } from "ethers";
import {uniswapv2,uniswapv3Router,uniswapv4Router,sushiswapv2Router,sushiswapv3Router,pancakeswapv3Router,curveRouter,ramsesv2Router,maverickv2Router,camelotRouter,} from "../constants/addresses";

/// Uniswap V2 / Sushiswap V2 / Camelot (mesma ABI)
const uniV2LikeAbi = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
];

export async function buildUniswapV2Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(uniswapv2, uniV2LikeAbi);


    const callData = router.interface.encodeFunctionData("swapExactTokensForTokens", [
      swap.amountIn,
      swap.amountOutMin,
      [swap.tokenIn, swap.tokenOut],
      swap.recipient,
      Math.floor(Date.now() / 1000) + 60,
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0), 
    };
  } catch (error) {
    console.error("Erro ao gerar calldata UniswapV2:", error);
    throw error;
  }
}

export async function buildSushiswapV2Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(sushiswapv2Router, uniV2LikeAbi);

    const callData = router.interface.encodeFunctionData("swapExactTokensForTokens", [
      swap.amountIn,
      swap.amountOutMin,
      [swap.tokenIn, swap.tokenOut],
      swap.recipient,
      Math.floor(Date.now() / 1000) + 60,
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata SushiswapV2:", error);
    throw error;
  }
}


export async function buildCamelotSwap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(camelotRouter, uniV2LikeAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("swapExactTokensForTokens", [
      swap.amountIn,
      swap.amountOutMin,
      [swap.tokenIn, swap.tokenOut],
      swap.recipient,
      Math.floor(Date.now() / 1000) + 60,
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0), 
    };
  } catch (error) {
    console.error("Erro ao gerar calldata Camelot:", error);
    return null;
  }
}



/// Uniswap V3 / Sushiswap V3 / PancakeSwap V3 / Ramses V2
const swapRouterAbi = [
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)",
];

export async function buildUniswapV3Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(uniswapv3Router, swapRouterAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("exactInputSingle", [
      {
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        fee: 3000,
        recipient: swap.recipient,
        amountIn: swap.amountIn,
        amountOutMin:swap.amountOutMin,
        sqrtPriceLimitX96: 0,}
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata UniswapV3:", error);
    return null;
  }
}

export async function buildSushiswapV3Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(sushiswapv3Router, swapRouterAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("exactInputSingle", [
      {
         tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        fee: 3000,
        recipient: swap.recipient,
        amountIn: swap.amountIn,
        amountOutMin:swap.amountOutMin,
        sqrtPriceLimitX96: 0,
      },
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata SushiswapV3:", error);
    return null;
  }
}

export async function buildPancakeswapV3Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(pancakeswapv3Router, swapRouterAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("exactInputSingle", [
      {
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        fee: 3000,
        recipient: swap.recipient,
        amountIn: swap.amountIn,
        amountOutMin:swap.amountOutMin,
        sqrtPriceLimitX96: 0,
      },
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata PancakeswapV3:", error);
    return null;
  }
}

export async function buildRamsesV2Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(ramsesv2Router, swapRouterAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("exactInputSingle", [
      {
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        fee: 3000,
        recipient: swap.recipient,
        amountIn: swap.amountIn,
        amountOutMin:swap.amountOutMin,
        sqrtPriceLimitX96: 0,
      },
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata RamsesV2:", error);
    return null;
  }
}



export async function buildUniswapV4Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const {
      tokenIn: fromToken,
      tokenOut: toToken,
      amountIn,
      amountOutMin,
      recipient,
      callbackRecipient = ethers.constants.AddressZero,
      sqrtPriceLimitX96 = 0
    } = swap;

    const iface = new ethers.utils.Interface([
      "function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes hookData) external returns (int256 amount0, int256 amount1)"
    ]);
    const router = new ethers.Contract(uniswapv4Router, iface);

    

    const [token0, token1] = [fromToken.toLowerCase(), toToken.toLowerCase()].sort();
    const zeroForOne = fromToken.toLowerCase() === token0;

    const hookData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "address"],
      [fromToken, toToken, callbackRecipient]
    );

    const callData = iface.encodeFunctionData("swap", [
      recipient,
      zeroForOne,
      BigNumber.from(amountIn).mul(-1), // exactIn
      sqrtPriceLimitX96,
      hookData,
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata Uniswap V4:", error);
    throw error;
  }
}

const maverickV2LikeAbi = [
  "function swapExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
];

/// Maverick V2
export async function buildMaverickV2Swap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const router = new ethers.Contract(maverickv2Router, maverickV2LikeAbi);

    // Preparando os dados da transação
    const callData = router.interface.encodeFunctionData("swapExactInputSingle", [
      swap.tokenIn,
      swap.tokenOut,
      swap.amountIn,
      0, // amountOutMin, você pode ajustar conforme necessário
      swap.recipient,
    ]);

    return {
      to: router.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata MaverickV2:", error);
    return null;
  }
}

const curveLikeAbi = [
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external"
];

/// Curve (simplificado, precisa da pool correta)
export async function buildCurveSwap(swap: DexSwap): Promise<BuiltSwapCall> {
  try {
    const pool = new ethers.Contract(curveRouter, curveLikeAbi);

    const i = 0;
    const j = 1;

    const callData = pool.interface.encodeFunctionData("exchange", [
      i,
      j,
      swap.amountIn,
      0,
    ]);

    return {
      to: pool.address,
      data: callData,
      value: BigNumber.from(0),
    };
  } catch (error) {
    console.error("Erro ao gerar calldata Curve:", error);
    return null;
  }
}
