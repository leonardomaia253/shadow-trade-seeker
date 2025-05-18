import { BigNumber, ethers } from "ethers";
import { UNISWAP_V3_QUOTER_ABI } from "../../constants/abis";

/**
 * Obtém a quantidade necessária de tokenIn para obter amountOut de tokenOut no Uniswap V3.
 */
export async function getV3Quote(
  quoterAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigNumber,
  provider: ethers.Signer | ethers.providers.Provider,
  fee: number = 3000 // 0.3% por padrão
): Promise<BigNumber> {
  const quoter = new ethers.Contract(quoterAddress, UNISWAP_V3_QUOTER_ABI, provider);
  const reversed = true;

  const quote = await quoter.callStatic.quoteExactOutputSingle({
    tokenIn,
    tokenOut,
    fee,
    amount: amountOut,
    sqrtPriceLimitX96: 0
  });

  return BigNumber.from(quote.amountIn || quote);
}
