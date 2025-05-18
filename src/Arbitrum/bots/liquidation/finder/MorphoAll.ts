import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";

const MORPHO_ADDRESS = "0x777777c9898d384f785ee44acfe945efdfaba0f3"; // Exemplo Arbitrum
const MORPHO_ABI = [
  "function isLiquidatable(address user) view returns (bool)",
  "function getCurrentSupplyBalanceInOf(address user) view returns (uint256)",
  "function getCurrentBorrowBalanceInOf(address user) view returns (uint256)",
  "function getUserHealthFactor(address user) view returns (uint256)",
];

export async function getMorphoLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const morpho = new Contract(MORPHO_ADDRESS, MORPHO_ABI, provider);

  // Lista de usuários deve ser coletada off-chain (evento ou API)
  const users = [
    "0xUserAddress1...",
    "0xUserAddress2...",
  ].slice(0, maxUsers);

  const opportunities = [];

  for (const user of users) {
    try {
      const isLiquidatable = await morpho.isLiquidatable(user);
      if (isLiquidatable) {
        const supply = await morpho.getCurrentSupplyBalanceInOf(user);
        const borrow = await morpho.getCurrentBorrowBalanceInOf(user);
        const healthFactor = await morpho.getUserHealthFactor(user);

        opportunities.push({
          user,
          healthFactor: parseFloat(formatUnits(healthFactor, 18)),
          supply: parseFloat(formatUnits(supply, 18)),
          borrow: parseFloat(formatUnits(borrow, 18)),
        });
      }
    } catch {
      continue;
    }
  }

  return opportunities;
}
