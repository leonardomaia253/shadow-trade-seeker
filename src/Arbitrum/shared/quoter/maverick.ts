import { BigNumber, ethers } from "ethers";
import { MAVERICK_QUOTER_ABI } from "../../constants/abis";

/**
 * Retorna a quantidade necessária de tokenIn para obter amountOut de tokenOut no Maverick V2.
 */
export async function getMaverickQuote(
  quoterAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigNumber,
  provider: ethers.Signer | ethers.providers.Provider
): Promise<BigNumber> {
  const quoter = new ethers.Contract(quoterAddress, MAVERICK_QUOTER_ABI, provider);

  const quote = await quoter.callStatic.quoteExactOutputSingle(
    tokenIn,
    tokenOut,
    amountOut,
    0 // priceLimit = 0 (sem limite)
  );

  return BigNumber.from(quote.amountIn || quote);
}
