import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";

// ABIs simplificadas (você pode substituir por ABIs completas reais)
import COMPTROLLER_ABI from "./abis/Comptroller.json";
import CTOKEN_ABI from "./abis/CToken.json";
import PRICE_ORACLE_ABI from "./abis/PriceOracle.json";

// Endereços conhecidos na Ethereum Mainnet (você pode adaptar para outros chains)
const COMPTROLLER_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"; // Mainnet
const ETH_DECIMALS = 18;

export async function getCompoundLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const comptroller = new Contract(COMPTROLLER_ADDRESS, COMPTROLLER_ABI, provider);
  const oracleAddr = await comptroller.oracle();
  const oracle = new Contract(oracleAddr, PRICE_ORACLE_ABI, provider);

  const markets: string[] = await comptroller.getAllMarkets();

  // Obtem dados dos cTokens (decimais, underlying, etc)
  const cTokens = await Promise.all(
    markets.map(async (addr) => {
      const contract = new Contract(addr, CTOKEN_ABI, provider);
      const [underlying, decimals] = await Promise.all([
        contract.callStatic.underlying().catch(() => "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"), // ETH wrapper
        contract.decimals(),
      ]);
      return {
        cToken: contract,
        address: addr,
        underlying,
        decimals,
      };
    })
  );

  // Cache de preços
  const priceCache: Record<string, BigNumber> = {};
  await Promise.all(
    cTokens.map(async ({ address }) => {
      priceCache[address.toLowerCase()] = await oracle.getUnderlyingPrice(address);
    })
  );

  // Busca todos os eventos de liquidação
  const events = await comptroller.queryFilter(comptroller.filters.MarketEntered());
  const userSet = new Set<string>();
  events.forEach((e) => {
    const user = e.args?.account?.toLowerCase();
    if (user) userSet.add(user);
  });

  const users = Array.from(userSet).slice(0, maxUsers);

  const opportunities = [];

  for (const user of users) {
    const [liquidity, shortfall] = await comptroller.getAccountLiquidity(user);

    // Apenas usuários com shortfall (> 0) estão sujeitos a liquidação
    if (shortfall.gt(0)) {
      const assetsIn = await comptroller.getAssetsIn(user);
      const collateral = [];
      const debt = [];

      for (const assetAddr of assetsIn) {
        const cTokenData = cTokens.find(c => c.address.toLowerCase() === assetAddr.toLowerCase());
        if (!cTokenData) continue;

        const { cToken, decimals, underlying } = cTokenData;
        const price = priceCache[assetAddr.toLowerCase()];
        const balance = await cToken.callStatic.balanceOfUnderlying(user);
        const borrow = await cToken.callStatic.borrowBalanceStored(user);

        const format = (val: BigNumber) => parseFloat(formatUnits(val.mul(price), decimals + ETH_DECIMALS));

        if (!balance.isZero()) {
          collateral.push({
            token: underlying,
            amount: format(balance),
          });
        }

        if (!borrow.isZero()) {
          debt.push({
            token: underlying,
            amount: format(borrow),
          });
        }
      }

      const shortfallETH = parseFloat(formatUnits(shortfall, ETH_DECIMALS));

      opportunities.push({
        user,
        shortfallETH,
        collateral,
        debt,
      });
    }
  }

  return opportunities.filter(op => op.debt.length && op.collateral.length);
}
