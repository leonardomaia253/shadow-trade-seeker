import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";

export async function getAaveLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const aave = getAaveContracts(provider);
  const pool = aave.pool;
  const oracle = aave.oracle;
  const reservesList = await pool.getReservesList();

  const reservesData = await Promise.all(
    reservesList.map(asset => pool.getReserveData(asset))
  );

  const reserves = reservesList.map((asset, i) => ({
    asset,
    data: reservesData[i],
  }));

  // Cache de preços dos ativos
  const priceCache: Record<string, BigNumber> = {};
  await Promise.all(
    reserves.map(async r => {
      const lowerAsset = r.asset.toLowerCase();
      if (!priceCache[lowerAsset]) {
        priceCache[lowerAsset] = await oracle.getAssetPrice(r.asset);
      }
    })
  );

  const liquidationEvents = await aave.pool.queryFilter(pool.filters.LiquidationCall());
  const userSet = new Set<string>();

  liquidationEvents.forEach((log) => {
    const user = log.args?.onBehalfOf.toLowerCase();
    if (user) userSet.add(user);
  });

  const users = Array.from(userSet).slice(0, maxUsers);

  // Consulta paralela dos dados de conta dos usuários
  const accountDataResults = await Promise.allSettled(
    users.map(user => pool.getUserAccountData(user))
  );

  const liquidatableUsers: string[] = [];
  const userAccountData: Record<string, Awaited<ReturnType<typeof pool.getUserAccountData>>> = {};

  accountDataResults.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      const user = users[i];
      const hf = parseFloat(formatUnits(res.value.healthFactor, 18));
      if (hf < 1.0) {
        liquidatableUsers.push(user);
        userAccountData[user] = res.value;
      }
    }
  });

  const opportunities = await Promise.all(
    liquidatableUsers.map(async (user) => {
      const account = userAccountData[user];
      const collateral = [];
      const debt = [];

      await Promise.all(
        reserves.map(async ({ asset }) => {
          const userReserveData = await pool.getUserReserveData(asset, user);
          const reserveData = reserves.find(r => r.asset === asset)?.data;

          const price = priceCache[asset.toLowerCase()] ?? BigNumber.from(0);
          const decimals = reserveData.decimals;
          const format = (val: BigNumber) => parseFloat(formatUnits(val.mul(price), decimals + 18));

          if (
            userReserveData.usageAsCollateralEnabled &&
            !userReserveData.currentATokenBalance.isZero()
          ) {
            collateral.push({
              token: asset,
              amount: format(userReserveData.currentATokenBalance),
            });
          }

          const stableDebt = !userReserveData.currentStableDebt.isZero()
            ? format(userReserveData.currentStableDebt)
            : 0;

          const variableDebt = !userReserveData.currentVariableDebt.isZero()
            ? format(userReserveData.currentVariableDebt)
            : 0;

          if (stableDebt + variableDebt > 0) {
            debt.push({
              token: asset,
              amount: stableDebt + variableDebt,
            });
          }
        })
      );

      return {
        user,
        healthFactor: parseFloat(formatUnits(account.healthFactor, 18)),
        totalCollateralETH: parseFloat(formatUnits(account.totalCollateralBase, 18)),
        totalDebtETH: parseFloat(formatUnits(account.totalDebtBase, 18)),
        collateral,
        debt,
      };
    })
  );

  return opportunities.filter(op => op.debt.length && op.collateral.length).sort((a, b) => (b.totalCollateralETH - b.totalDebtETH) - (a.totalCollateralETH - a.totalDebtETH));

}
