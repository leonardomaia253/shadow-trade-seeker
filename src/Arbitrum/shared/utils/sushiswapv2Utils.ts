import { ethers, BigNumber, Contract } from 'ethers';
import { provider } from '../../config/provider';

// Endereço oficial SushiSwap V2 Factory mainnet
const SUSHISWAP_V2_FACTORY_ADDRESS = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';

// ABI igual ao Uniswap V2 (simplificada)
const SUSHISWAP_V2_FACTORY_ABI = [
  {
    constant: true,
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' }
    ],
    name: 'getPair',
    outputs: [{ internalType: 'address', name: 'pair', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
];

const SUSHISWAP_V2_PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint112', name: '_reserve0', type: 'uint112' },
      { internalType: 'uint112', name: '_reserve1', type: 'uint112' },
      { internalType: 'uint32', name: '_blockTimestampLast', type: 'uint32' }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
];

const factoryContract = new Contract(SUSHISWAP_V2_FACTORY_ADDRESS, SUSHISWAP_V2_FACTORY_ABI, provider);

async function getPairAddress(tokenA: string, tokenB: string): Promise<string | null> {
  const pairAddress = await factoryContract.getPair(tokenA, tokenB);
  if (pairAddress === ethers.constants.AddressZero) return null;
  return pairAddress;
}

async function getReserves(pairAddress: string, tokenIn: string, tokenOut: string): Promise<{ reserveIn: BigNumber; reserveOut: BigNumber }> {
  const pairContract = new Contract(pairAddress, SUSHISWAP_V2_PAIR_ABI, provider);
  const [reserve0, reserve1] = await pairContract.getReserves();
  const token0 = await pairContract.token0();

  if (tokenIn.toLowerCase() === token0.toLowerCase()) {
    return { reserveIn: reserve0, reserveOut: reserve1 };
  } else {
    return { reserveIn: reserve1, reserveOut: reserve0 };
  }
}

function getAmountOut(amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber): BigNumber {
  const amountInWithFee = amountIn.mul(997);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  return numerator.div(denominator);
}

export async function getQuoteSushiswapV2(from: string, to: string, amountIn: BigNumber): Promise<BigNumber> {
  if (from.toLowerCase() === to.toLowerCase()) return amountIn;

  const pairAddress = await getPairAddress(from, to);
  if (!pairAddress) return BigNumber.from(0);

  const { reserveIn, reserveOut } = await getReserves(pairAddress, from, to);
  if (reserveIn.isZero() || reserveOut.isZero()) return BigNumber.from(0);

  return getAmountOut(amountIn, reserveIn, reserveOut);
}
