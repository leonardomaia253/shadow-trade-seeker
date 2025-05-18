import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";

const RADIANT_COMPTROLLER_ADDRESS = "0x..."; // Coloque endereço oficial Radiant Arbitrum
const RADIANT_COMPTROLLER_ABI = [
  "function getAssetsIn(address user) view returns (address[])",
  "function getAccountLiquidity(address user) view returns (uint256, uint256, uint256)",
];

const RADIANT_CTOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function borrowBalanceCurrent(address) returns (uint256)",
  "function underlying() view returns (address)",
  "function decimals() view returns (uint8)",
];

export async function getRadiantLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const comptroller = new Contract(RADIANT_COMPTROLLER_ADDRESS, RADIANT_COMPTROLLER_ABI, provider);

  const users = [
    "0xUserAddress1...",
    "0xUserAddress2...",
  ].slice(0, maxUsers);

  const opportunities = [];

  for (const user of users) {
    try {
      const [error, liquidity, shortfall] = await comptroller.getAccountLiquidity(user);
      if (shortfall.gt(0)) {
        const assets = await comptroller.getAssetsIn(user);
        const tokensData = await Promise.all(assets.map(async (ctokenAddr) => {
          const ctoken = new Contract(ctokenAddr, RADIANT_CTOKEN_ABI, provider);
          const balance = await ctoken.balanceOf(user);
          const borrow = await ctoken.borrowBalanceCurrent(user);
          const underlying = await ctoken.underlying();
          const decimals = await ctoken.decimals();

          return {
            ctoken: ctokenAddr,
            underlying,
            balance: parseFloat(formatUnits(balance, decimals)),
            borrow: parseFloat(formatUnits(borrow, decimals)),
          };
        }));

        opportunities.push({
          user,
          liquidity: parseFloat(formatUnits(liquidity, 18)),
          shortfall: parseFloat(formatUnits(shortfall, 18)),
          tokensData,
        });
      }
    } catch {
      continue;
    }
  }

  return opportunities;
}
