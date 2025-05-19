// utils/maverickRouter.ts
import { Contract, BigNumber } from 'ethers';
import { provider } from '../../config/provider';
import { UNISWAP_V2_ROUTER_ABI } from '../../constants/abis';

// Endereço do roteador Maverick V2 (exemplo, confirme o endereço real)
const MAVERICK_ROUTER_ADDRESS = '0xYourMaverickV2RouterAddressHere';

export const maverickRouter = new Contract(
  MAVERICK_ROUTER_ADDRESS,
  UNISWAP_V2_ROUTER_ABI,
  provider
);

export async function getQuoteMaverickV2(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  try {
    const amounts = await maverickRouter.getAmountsOut(amountIn, [from, to]);
    return amounts[1];
  } catch {
    return BigNumber.from(0);
  }
}
