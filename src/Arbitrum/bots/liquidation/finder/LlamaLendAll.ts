import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import LLAMALEND_ABI from "./abis/LlamaLendMarket.json";

type LlamaLendMarket = {
  address: string;
  underlying: string;
  decimals: number;
};

export async function getLlamaLendLiquidationOpportunities(
  provider: JsonRpcProvider,
  markets: LlamaLendMarket[],
  usersPerMarket: string[]
) {
  const opportunities = [];

  for (const market of markets) {
    const contract = new Contract(market.address, LLAMALEND_ABI, provider);
    const price = await contract.oraclePrice(); // ou similar

    for (const user of usersPerMarket) {
      const [collateral, debt] = await Promise.all([
        contract.collateral(user),
        contract.borrowBalanceStored(user),
      ]);

      const collateralETH = parseFloat(formatUnits(collateral.mul(price), market.decimals + 18));
      const debtETH = parseFloat(formatUnits(debt.mul(price), market.decimals + 18));

      if (debtETH > 0 && collateralETH / debtETH < 1.0) {
        opportunities.push({
          user,
          market: market.address,
          collateralETH,
          debtETH,
          healthFactor: collateralETH / debtETH,
        });
      }
    }
  }

  return opportunities.sort((a, b) => a.healthFactor - b.healthFactor);
}
