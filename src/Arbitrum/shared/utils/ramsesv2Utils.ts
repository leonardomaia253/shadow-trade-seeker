// utils/ramsesRouter.ts
import { Contract, BigNumber } from 'ethers';
import { provider } from '../../config/provider';
import { UNISWAP_V2_ROUTER_ABI } from '../../constants/abis';

// Endereço do roteador Ramses V2
const RAMSES_ROUTER_ADDRESS = '0xAAA6C1E32C55A7BFA8066A6FAE9B42650F262418';

export const ramsesRouter = new Contract(
  RAMSES_ROUTER_ADDRESS,
  UNISWAP_V2_ROUTER_ABI,
  provider
);

export async function getQuoteRamsesV2(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  try {
    const amounts = await ramsesRouter.getAmountsOut(amountIn, [from, to]);
    return amounts[1];
  } catch {
    return BigNumber.from(0);
  }
}