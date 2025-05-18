import { JsonRpcProvider } from "@ethersproject/providers";
import { Contract, BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import COMPTROLLER_ABI from "./abis/CompoundComptroller.json";
import CTOKEN_ABI from "./abis/CToken.json";
import ERC20_ABI from "./abis/ERC20.json";
import ORACLE_ABI from "./abis/CompoundOracle.json";

const COMPTROLLER_ADDRESS = "0x3d5bc3c8b89d4791cdac0ad0f64b11a0f5b8867c"; // Ex: Cream on Fantom

export async function getCreamLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const comptroller = new Contract(COMPTROLLER_ADDRESS, COMPTROLLER_ABI, provider);
  const oracleAddress = await comptroller.oracle();
  const oracle = new Contract(oracleAddress, ORACLE_ABI, provider);

  const markets: string[] = await comptroller.getAllMarkets();

  const marketInfo = await Promise.all(
    markets.map(async (cTokenAddr) => {
      const cToken = new Contract(cTokenAddr, CTOKEN_ABI, provider);
      const underlyingAddr = await cToken.underlying().catch(() => "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
      const decimals = underlyingAddr === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        ? 18
        : await new Contract(underlyingAddr, ERC20_ABI, provider).decimals();
      return { cToken, cTokenAddr, underlyingAddr, decimals };
    })
  );

  const events = await comptroller.queryFilter(comptroller.filters.LiquidateBorrow());
  const userSet = new Set(events.map(e => e.args?.borrower.toLowerCase()));
  const users = Array.from(userSet).slice(0, maxUsers);

  const opportunities = [];

  for (const user of users) {
    const [liquidity, shortfall] = await comptroller.getAccountLiquidity(user);
    if (shortfall.gt(0)) {
      const collateral = [];
      const debt = [];

      for (const { cToken, cTokenAddr, underlyingAddr, decimals } of marketInfo) {
        const [borrowBalance, balanceUnderlying, exchangeRate] = await Promise.all([
          cToken.borrowBalanceStored(user),
          cToken.balanceOfUnderlying(user).catch(() => BigNumber.from(0)),
          cToken.exchangeRateStored(),
        ]);
        const price = await oracle.getUnderlyingPrice(cTokenAddr);

        const format = (amount: BigNumber) => parseFloat(formatUnits(amount.mul(price), 36 + decimals));

        if (!borrowBalance.isZero()) {
          debt.push({ token: underlyingAddr, amount: format(borrowBalance) });
        }
        if (!balanceUnderlying.isZero()) {
          collateral.push({ token: underlyingAddr, amount: format(balanceUnderlying) });
        }
      }

      const totalDebtETH = debt.reduce((sum, d) => sum + d.amount, 0);
      const totalCollateralETH = collateral.reduce((sum, c) => sum + c.amount, 0);

      opportunities.push({
        user,
        totalCollateralETH,
        totalDebtETH,
        healthFactor: totalCollateralETH > 0 ? totalCollateralETH / totalDebtETH : 0,
        collateral,
        debt,
      });
    }
  }

  return opportunities
    .filter(op => op.collateral.length && op.debt.length)
    .sort((a, b) => (b.totalCollateralETH - b.totalDebtETH) - (a.totalCollateralETH - a.totalDebtETH));
}
