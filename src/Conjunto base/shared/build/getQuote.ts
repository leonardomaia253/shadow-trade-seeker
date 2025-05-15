import { ethers } from "ethers";
import { getQuote as getMaverickQuote } from "@maverick/sdk";
// Assumindo o uso do Maverick SDK oficial (v2)

// ABI mínima
const UNISWAP_V2_PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const UNISWAP_V3_QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
];

const CURVE_POOL_ABI = [
  "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)"
];

const MAVERICK_V2_PAIR_ABI = [
  "function getBin(uint128 binId) external view returns (Bin memory)"
];

const CURVE_POOL_ABI = [
  "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)"
];

export async function getQuote(
  provider: ethers.Provider,
  dex: string,
  params: {
    tokenIn: string,
    tokenOut: string,
    amountIn: ethers.BigNumberish,
    extra?: {
      pairAddress?: string,
      quoterAddress?: string,
      poolAddress?: string,
      fee?: number,
      i?: number,
      j?: number,
      maverickConfig?: any,
      uniswapV4QuoteFn?: (
        provider: ethers.Provider,
        tokenIn: string,
        tokenOut: string,
        amountIn: ethers.BigNumberish
      ) => Promise<ethers.BigNumber>
    }
  }
): Promise<ethers.BigNumber> {
  const { tokenIn, tokenOut, amountIn, extra } = params;
  switch (dex.toLowerCase()) {
    case "uniswapv2":
    case "sushiswapv2":
    case "camelot": {
      const pair = new ethers.Contract(extra!.pairAddress!, UNISWAP_V2_PAIR_ABI, provider);
      const [r0, r1] = await pair.getReserves();
      const token0 = await pair.token0();
      const token1 = await pair.token1();
      let reserveIn, reserveOut;
      if (tokenIn.toLowerCase() === token0.toLowerCase()) {
        reserveIn = r0;
        reserveOut = r1;
      } else {
        reserveIn = r1;
        reserveOut = r0;
      }
      const amountInWithFee = ethers.BigNumber.from(amountIn).mul(997);
      const numerator = amountInWithFee.mul(reserveOut);
      const denominator = reserveIn.mul(1000).add(amountInWithFee);
      return numerator.div(denominator);
    }

    case "uniswapv3":
    case "sushiswapv3": 
    case "pancakeswapv3":
    case "ramsesv2":
    case "uniswapv4":  {
      const quoter = new ethers.Contract(extra!.quoterAddress!, UNISWAP_V3_QUOTER_ABI, provider);
      return await quoter.quoteExactInputSingle(tokenIn, tokenOut, extra!.fee!, amountIn, 0);
    }

    case "curve": {
      const pool = new ethers.Contract(extra!.poolAddress!, CURVE_POOL_ABI, provider);
      return await pool.get_dy(extra!.i!, extra!.j!, amountIn);
    }

    case "maverickv2": {
      if (!extra?.maverickConfig) throw new Error("Maverick config ausente");
      const quote = await getMaverickQuote({
        tokenIn,
        tokenOut,
        amountIn,
        ...extra.maverickConfig,
        provider
      });
      return ethers.BigNumber.from(quote.amountOut);
    }

    case "uniswapv4": {
      if (!extra?.uniswapV4QuoteFn) throw new Error("Função de quote personalizada para UniswapV4 ausente");
      return await extra.uniswapV4QuoteFn(provider, tokenIn, tokenOut, amountIn);
    }

    default:
      throw new Error("DEX não suportado");
  }
}
