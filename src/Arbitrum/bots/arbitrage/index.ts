import { ethers } from "ethers";
import { getExecutorContract } from "./executor";
import { buildOrchestrationFromRoute } from "./arbitragebuilder";
import { fetchTopTokensArbitrum } from "../../utils/tokensdefi";
import { findBestArbitrageRoute } from "./arbitrageScanner";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";
import { TokenInfo } from "../../utils/types";
import { convertRouteToSwapSteps } from "../../utils/swapsteps";
import{ executeFlashloanBundle} from "./executor"

async function main() {
  const provider = new ethers.providers.WebSocketProvider("wss://arb-mainnet.g.alchemy.com/v2/o--1ruggGezl5R36rrSDX8JiVouHQOJO");
  const privateKey = "0x406769da0204de94ad7bf22a4edb240a85b223dfbb884023e5ce423453f7be7c";
  const contract = await getExecutorContract(provider, privateKey);

  const baseToken: TokenInfo = {
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
    symbol: "WETH",
    decimals: 18,
  };

  console.log("🔍 Buscando tokens top 200 por volume na Arbitrum...");
  const tokenList = await fetchTopTokensArbitrum(200);

  if (tokenList.length === 0) {
    console.error("❌ Lista de tokens vazia, abortando.");
    return;
  }

  console.log(`✅ Tokens carregados: ${tokenList.length}. Rodando busca de arbitragem...`);

  const bestRoute = await findBestArbitrageRoute({
    provider,
    baseToken,
    tokenList,
  });

  if (bestRoute) {
    // Exibe o caminho detalhado dos swaps
    console.log("✅ Melhor rota de arbitragem encontrada:");
    console.log(
      "Caminho:",
      bestRoute.route.map((swap) => swap.tokenIn.symbol).join(" → ") + " → " + bestRoute.route.at(-1)?.tokenOut.symbol
    );
    console.log("DEXs:", bestRoute.route.map((swap) => swap.dex).join(" → "));
    console.log("Lucro líquido:", ethers.utils.formatUnits(bestRoute.netProfit, baseToken.decimals), baseToken.symbol);

    // Monta as calls para a execução no contrato executor
    const swapSteps = await convertRouteToSwapSteps(bestRoute.route); 
    const calls = await buildOrchestrationFromRoute(swapSteps, EXECUTOR_CONTRACTARBITRUM);


    // Monta o flashloan baseado no baseToken e valor de input da rota
    const flashloans = [
      {
        provider: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Substituir pelo endereço real do lending pool
        token: baseToken.address,
        amount: bestRoute.inputAmount,
      },
    ];

    await executeFlashloanBundle(contract, flashloans, calls, provider);
  } else {
    console.log("⚠️ Nenhuma arbitragem lucrativa encontrada.");
  }
}

main().catch((e) => {
  console.error("❌ Erro no executor:", e);
});
