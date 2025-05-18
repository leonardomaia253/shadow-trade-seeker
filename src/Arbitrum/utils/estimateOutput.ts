import { ethers } from "ethers";
import { getProvider } from "../constants/config"; // customizada por rede
import { DEX_ROUTER } from "../constants/addresses";

const provider = getProvider();


const MaverickQuoterABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut)"
];

const UniswapV4RouterABI = [
  "function quote(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut)"
];

const UniswapV3QuoterABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) view returns (uint256 amountOut)"
];

const UniswapV2RouterABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory)"
];


const CurveRegistryV2ABI = [
  "function find_pool_for_coins(address from, address to) view returns (address pool)",
  "function get_coin_indices(address pool, address from, address to) view returns (int128, int128, bool)"
];

const CurvePoolABI = [
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)"
];

// Endereço do Address Provider Curve - exemplo Arbitrum (mude se estiver em outra chain)
const CURVE_ADDRESS_PROVIDER = "0x0000000022D53366457F9d5E68Ec105046FC4383";

// Helper para UniswapV3-style paths
function encodeUniswapV3Path(path: string[], fees: number[]): string {
  let encoded = "0x";
  for (let i = 0; i < path.length - 1; i++) {
    encoded += path[i].slice(2);
    encoded += fees[i].toString(16).padStart(6, "0");
  }
  encoded += path[path.length - 1].slice(2);
  return encoded;
}

export async function estimateSwapOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: ethers.BigNumber,
  dex: string
): Promise<ethers.BigNumber> {
  const lowerDex = dex.toLowerCase();

  try {
    // V2-style routers
    if (["uniswapv2", "sushiswapv2", "ramsesv2","camelot"].includes(lowerDex)) {
      const router = new ethers.Contract(DEX_ROUTER[lowerDex], UniswapV2RouterABI, provider);
      const amountsOut = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
      return amountsOut[1];
    }

    if (["uniswapv4"].includes(lowerDex)) {
      const router = new ethers.Contract(DEX_ROUTER[lowerDex], UniswapV4RouterABI, provider);
      const amountsOut = await router.quote(amountIn, [tokenIn, tokenOut]);
      return amountsOut[1];
    }

    // V3/V4 with Quoter
    if (["uniswapv3", "sushiswapv3", "pancakeswapv3"].includes(lowerDex)) {
      const quoter = new ethers.Contract(DEX_ROUTER[lowerDex], UniswapV3QuoterABI, provider);
      const path = encodeUniswapV3Path([tokenIn, tokenOut], [3000]); // assume fee de 0.3%
      const amountsOut = await quoter.callStatic.quoteExactInput(path, amountIn);
      return amountsOut.amountOut || amountsOut; // alguns retornam só o número
    }

    if (["maverickv2"].includes(lowerDex)) {
      const quoter = new ethers.Contract(DEX_ROUTER[lowerDex], MaverickQuoterABI, provider);
      const path = encodeUniswapV3Path([tokenIn, tokenOut], [3000]); // assume fee de 0.3%
      const amountsOut = await quoter.callStatic.quoteExactInput(path, amountIn);
      return amountsOut.amountOut || amountsOut; // alguns retornam só o número
    }

    // Curve (exige índice dos tokens)
      if (lowerDex === "curve") {
    // Instancia o address provider Curve
    const addressProvider = new ethers.Contract(CURVE_ADDRESS_PROVIDER, CurveRegistryV2ABI, provider);

    // Pega o registry (V2)
    const registryAddress = await addressProvider.get_registry();
    const registry = new ethers.Contract(registryAddress, CurveRegistryV2ABI, provider);

    // Busca o pool correto para o par de tokens
    const poolAddress = await registry.find_pool_for_coins(tokenIn, tokenOut);
    if (poolAddress === ethers.constants.AddressZero) {
      throw new Error("Curve pool not found for token pair");
    }

    // Consulta índices dos tokens no pool
    const [iRaw, jRaw, success] = await registry.get_coin_indices(poolAddress, tokenIn, tokenOut);
    if (!success) {
      throw new Error("Tokens pair not found in Curve pool");
    }
    const i = iRaw; // int128 no ethers é BigNumber
    const j = jRaw;

    // Instancia o pool
    const pool = new ethers.Contract(poolAddress, CurvePoolABI, provider);

    // Chama get_dy para estimar saída
    const amountOut = await pool.get_dy(i, j, amountIn);

    return amountOut;
  }

    throw new Error(`DEX ${dex} não suportado`);
  } catch (err) {
    console.warn(`[estimateSwapOutput] Falha ao estimar para ${dex}:`, err);
    return ethers.BigNumber.from(0);
  }
}
