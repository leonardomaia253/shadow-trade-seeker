import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";

const SPARK_COMPTROLLER_ADDRESS = "0x0d5a3c9F5B687bff791E388B9A2F1F08693aB620"; // Exemplo - confirmar na Arbitrum
const SPARK_COMPTROLLER_ABI = [
  "function getAssetsIn(address user) view returns (address[])",
  "function getAccountLiquidity(address user) view returns (uint256, uint256, uint256)",
];

const SPARK_CTOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function borrowBalanceCurrent(address) returns (uint256)",
  "function underlying() view returns (address)",
  "function decimals() view returns (uint8)",
];

export async function getSparkLiquidationOpportunities(provider: JsonRpcProvider, maxUsers = 50) {
  const comptroller = new Contract(SPARK_COMPTROLLER_ADDRESS, SPARK_COMPTROLLER_ABI, provider);

  // 1) Buscar usuários com ativos no Spark — este passo normalmente requer off-chain (eventos ou API)
  // Aqui simulamos uma lista fixa, pois Spark não expõe lista pública fácil (você precisa coletar off-chain)
  // Para exemplo, considere uma lista dummy:
  const users = [
    "0xUserAddress1...",
    "0xUserAddress2...",
    // ...
  ].slice(0, maxUsers);

  const opportunities = [];

  for (const user of users) {
    try {
      // getAccountLiquidity retorna (error, liquidity, shortfall)
      // liquidity = excesso de colateral, shortfall = falta de colateral (liquidável se shortfall > 0)
      const [error, liquidity, shortfall] = await comptroller.getAccountLiquidity(user);

      if (shortfall.gt(0)) {
        // usuário está liquidável
        // busque os ativos que ele possui como colateral
        const assets = await comptroller.getAssetsIn(user);

        // Pegue dados para cada cToken (em paralelo)
        const tokensData = await Promise.all(assets.map(async (ctokenAddr) => {
          const ctoken = new Contract(ctokenAddr, SPARK_CTOKEN_ABI, provider);
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
