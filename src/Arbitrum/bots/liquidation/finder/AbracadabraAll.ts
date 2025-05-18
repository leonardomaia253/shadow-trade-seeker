import { BigNumber, Contract } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { JsonRpcProvider } from "@ethersproject/providers";

// --- CONFIGURAÇÃO ---

// Endereço do contrato Abracadabra LendingPool na Arbitrum (confirme no explorer)
const LENDING_POOL_ADDRESS = "0x3f5ce5fbfe3e9af3971dD833D26BA9b5C936f0bE"; // *EXEMPLO* -- substituir pelo real

// ABI resumida necessária (ajuste conforme ABI oficial do LendingPool Abracadabra)
const LENDING_POOL_ABI = [
  // Método para listar posições (exemplo, adapte para Abracadabra)
  "event LogBorrow(address indexed user, uint256 amount, uint256 borrowPart)",
  "function userBorrowPart(address user) view returns (uint256)",
  "function userCollateralShare(address user) view returns (uint256)",
  "function health(address user) view returns (uint256)", // suposto health factor * 1e18
  "function totalBorrow() view returns (uint256)",
  "function totalCollateral() view returns (uint256)",
  "function exchangeRate() view returns (uint256)"
];

// --- Função principal ---

export async function getAbracadabraLiquidationOpportunities(
  provider: JsonRpcProvider,
  maxUsers = 50
) {
  const lendingPool = new Contract(LENDING_POOL_ADDRESS, LENDING_POOL_ABI, provider);

  // 1) Buscar logs de LogBorrow para listar usuários que tomaram empréstimo
  const borrowEventSig = lendingPool.interface.getEventTopic("LogBorrow");

  const filter = {
    address: LENDING_POOL_ADDRESS,
    topics: [borrowEventSig],
    fromBlock: 0, // otimize conforme necessidade
    toBlock: "latest",
  };

  const logs = await provider.getLogs(filter);
  const userSet = new Set<string>();
  logs.forEach(log => {
    const parsed = lendingPool.interface.parseLog(log);
    userSet.add(parsed.args.user.toLowerCase());
  });

  const users = Array.from(userSet).slice(0, maxUsers);

  // 2) Para cada usuário, verificar health
  const opportunities = [];

  for (const user of users) {
    try {
      const healthRaw: BigNumber = await lendingPool.health(user); // health factor em 1e18

      // Se health < 1 (1e18), usuário pode ser liquidado
      if (healthRaw.lt(BigNumber.from("1000000000000000000"))) {
        // Pegar dados de dívida e colateral
        const borrowPart: BigNumber = await lendingPool.userBorrowPart(user);
        const collateralShare: BigNumber = await lendingPool.userCollateralShare(user);
        const exchangeRate: BigNumber = await lendingPool.exchangeRate();

        // Calcular valores aproximados (mim)
        // borrowPart e collateralShare geralmente em shares, converter para tokens:

        // Supondo que exchangeRate converte collateralShare para tokens, para dívida usar borrowPart direto

        // Converter para float com 18 decimais
        const borrowAmount = parseFloat(formatUnits(borrowPart, 18));
        const collateralAmount = parseFloat(formatUnits(collateralShare.mul(exchangeRate).div(BigNumber.from(10).pow(18)), 18));

        opportunities.push({
          user,
          healthFactor: parseFloat(formatUnits(healthRaw, 18)),
          borrowAmount,
          collateralAmount,
        });
      }
    } catch (e) {
      // Pode ignorar erros individuais de usuários
      continue;
    }
  }

  // Ordenar oportunidades por menor health factor (mais urgente)
  opportunities.sort((a, b) => a.healthFactor - b.healthFactor);

  return opportunities;
}
