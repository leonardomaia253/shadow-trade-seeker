import { ethers } from "ethers";

export function buildSwapToETHCall({
  tokenIn,
  amountIn,
  recipient
}: {
  tokenIn: string;
  amountIn: string;
  recipient: string;
}) {
  const WETH = "0x4200000000000000000000000000000000000006"; // WETH Arbitrum
  const router = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 router
  const fee = 3000; // 0.3%
  const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

  const abi = [
    "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))"
  ];

  const iface = new ethers.utils.Interface(abi);

  const data = iface.encodeFunctionData("exactInputSingle", [{
    tokenIn,
    tokenOut: WETH,
    fee,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum:0,
    sqrtPriceLimitX96: 0
  }]);

  return {
    to: router,
    data
  };
}
