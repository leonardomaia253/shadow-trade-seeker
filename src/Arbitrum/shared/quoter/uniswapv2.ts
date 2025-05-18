import { BigNumber, ethers } from "ethers";
import { UNISWAP_V2_ROUTER_ABI } from "../../constants/abis";

/**
 * Retorna a quantidade de tokenIn necessária para receber amountOut de tokenOut no Uniswap V2.
 * Usa getAmountsIn para uma rota direta entre os dois tokens.
 */
export async function getUniswapV2Quote(
  routerAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigNumber,
  provider: ethers.Signer | ethers.providers.Provider
): Promise<BigNumber> {
  const router = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, provider);
  const path = [tokenIn, tokenOut];

  try {
    const amountsIn = await router.getAmountsIn(amountOut, path);
    return amountsIn[0];
  } catch (err) {
    throw new Error(`Erro ao obter cotação UniswapV2: ${(err as any).reason || err}`);
  }
}
