
import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";

// Define the getAaveContracts function that was missing
const getAaveContracts = (provider: JsonRpcProvider) => {
  const poolAddress = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Aave V3 Pool on Arbitrum
  const oracleAddress = "0xb56c2F0B653B2e0b10C9b928C8580Ac5Df02C7C7"; // Aave V3 Oracle on Arbitrum
  
  // Simplified ABIs for demonstration
  const poolABI = [
    "function getReservesList() view returns (address[])",
    "function getReserveData(address asset) view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))",
    "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
    "function getUserReserveData(address asset, address user) view returns (tuple(uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint256,uint256))",
    "event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)"
  ];
  
  const oracleABI = [
    "function getAssetPrice(address asset) view returns (uint256)"
  ];
  
  return {
    pool: new Contract(poolAddress, poolABI, provider),
    oracle: new Contract(oracleAddress, oracleABI, provider)
  };
};

export async function getAaveLiquidationOpportunities(provider: JsonRpcProvider, minProfitUsd = 100) {
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
    const user = log.args?.user.toLowerCase();
    if (user) userSet.add(user);
  });

  const users = Array.from(userSet).slice(0, 50);

  // Consulta paralela dos dados de conta dos usuários
  const accountDataResults = await Promise.allSettled(
    users.map(user => pool.getUserAccountData(user))
  );

  const liquidatableUsers: string[] = [];
  const userAccountData: Record<string, any> = {};

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
          const decimals = reserveData?.decimals || 18;
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
        protocol: "aave",
        userAddress: user,
        healthFactor: parseFloat(formatUnits(account.healthFactor, 18)),
        totalCollateralETH: parseFloat(formatUnits(account.totalCollateralBase, 18)),
        totalDebtETH: parseFloat(formatUnits(account.totalDebtBase, 18)),
        collateralAsset: collateral.length > 0 ? collateral[0].token : null,
        debtAsset: debt.length > 0 ? debt[0].token : null,
        collateralAmount: collateral.length > 0 ? collateral[0].amount : 0,
        debtAmount: debt.length > 0 ? debt[0].amount : 0,
        collateral,
        debt,
      };
    })
  );

  return opportunities.filter(op => op.debt.length && op.collateral.length)
    .sort((a, b) => (b.totalCollateralETH - b.totalDebtETH) - (a.totalCollateralETH - a.totalDebtETH));
}
