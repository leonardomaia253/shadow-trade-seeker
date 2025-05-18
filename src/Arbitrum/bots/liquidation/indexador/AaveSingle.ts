import { ethers } from "ethers";

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface AaveUserData {
  user: string;
  collateralTokens: TokenInfo[];
  debtTokens: TokenInfo[];
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
}

const dataProviderABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function getUserConfiguration(address user) view returns (uint256 data)",
  "function getReservesList() view returns (address[])",
];

const erc20MinimalABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

function parseUserConfigBits(data: ethers.BigNumber, reserves: string[]): { collateral: string[]; debt: string[] } {
  const collateral: string[] = [];
  const debt: string[] = [];

  reserves.forEach((reserve, i) => {
    const bitIndex = i * 2;
    const isCollateral = data.shr(bitIndex).and(1).eq(1);
    const isBorrowing = data.shr(bitIndex + 1).and(1).eq(1);
    if (isCollateral) collateral.push(reserve);
    if (isBorrowing) debt.push(reserve);
  });

  return { collateral, debt };
}

async function enrichTokenInfo(provider: ethers.providers.Provider, address: string): Promise<TokenInfo> {
  const token = new ethers.Contract(address, erc20MinimalABI, provider);
  const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
  return { address, symbol, decimals };
}

export async function getUserAaveAccountData(
  provider: ethers.providers.Provider,
  user: string,
  dataProviderAddress: string
): Promise<AaveUserData | null> {
  const contract = new ethers.Contract(dataProviderAddress, dataProviderABI, provider);

  const [userData, userConfigBits, reservesList]: [
    any,
    { data: ethers.BigNumber },
    string[]
  ] = await Promise.all([
    contract.getUserAccountData(user),
    contract.getUserConfiguration(user),
    contract.getReservesList(),
  ]);

  if (userData.healthFactor.gt(ethers.utils.parseUnits("2", 18))) return null;

  const { collateral, debt } = parseUserConfigBits(userConfigBits.data, reservesList);

  const [collateralTokens, debtTokens] = await Promise.all([
    Promise.all(collateral.map(addr => enrichTokenInfo(provider, addr))),
    Promise.all(debt.map(addr => enrichTokenInfo(provider, addr))),
  ]);

  return {
    user,
    collateralTokens,
    debtTokens,
    healthFactor: Number(ethers.utils.formatUnits(userData.healthFactor, 18)),
    totalCollateralUSD: Number(userData.totalCollateralBase) / 1e8,
    totalDebtUSD: Number(userData.totalDebtBase) / 1e8,
  };
}
