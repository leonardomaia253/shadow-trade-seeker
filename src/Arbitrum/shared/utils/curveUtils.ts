import { BigNumber, Contract } from 'ethers';
import { CURVE_POOL_ABI } from '../../constants/abis';
import { provider } from '../../config/provider';

const CURVE_POOL_ADDRESS = '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022'; // exemplo: stETH/ETH pool

export const curvePool = new Contract(
  CURVE_POOL_ADDRESS,
  CURVE_POOL_ABI,
  provider
) as Contract & {
  coins(i: number): Promise<string>;
  get_dy(i: number, j: number, dx: BigNumber): Promise<BigNumber>;
};

export async function getQuoteCurve(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  try {
    const i = await getCoinIndex(from);
    const j = await getCoinIndex(to);
    return await curvePool.get_dy(i, j, amountIn);
  } catch {
    return BigNumber.from(0);
  }
}

async function getCoinIndex(token: string): Promise<number> {
  for (let i = 0; i < 8; i++) {
    try {
      const coin = await curvePool.coins(i);
      if (coin.toLowerCase() === token.toLowerCase()) {
        return i;
      }
    } catch {
      break;
    }
  }
  throw new Error('Token not found in pool');
}