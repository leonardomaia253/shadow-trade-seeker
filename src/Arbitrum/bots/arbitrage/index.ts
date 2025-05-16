import { ethers } from "ethers";
import "dotenv/config";
import { getExecutorContract } from "./executor";
import { buildOrchestrationFromRoute } from "./arbitragebuilder";
import { fetchTopTokensArbitrum } from "../../utils/tokensdefi";
import { findBestArbitrageRoute } from "./arbitrageScanner";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";
import { TokenInfo } from "../../utils/types";
import { convertRouteToSwapSteps } from "../../utils/swapsteps";
import { executeFlashloanBundle } from "./executor";
import { supabase } from "../../utils/supabase"; // <- ajuste se o caminho for diferente

const MIN_PROFIT_ETH = 0.01;

const baseToken: TokenInfo = {
  address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
  symbol: "WETH",
  decimals: 18,
};

const provider = new ethers.providers.WebSocketProvider(process.env.ALCHEMY_WSS!);
const privateKey = process.env.PRIVATE_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function executeCycle() {
  const contract = await getExecutorContract(provider, privateKey);

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
    const profitInETH = parseFloat(ethers.utils.formatUnits(bestRoute.netProfit, baseToken.decimals));

    if (profitInETH < MIN_PROFIT_ETH) {
      console.log(`⚠️ Lucro ${profitInETH} ETH abaixo do mínimo. Ignorando...`);
      return;
    }

    console.log("✅ Melhor rota de arbitragem encontrada:");
    console.log(
      "Caminho:",
      bestRoute.route.map((swap) => swap.tokenIn.symbol).join(" → ") + " → " + bestRoute.route.at(-1)?.tokenOut.symbol
    );
    console.log("DEXs:", bestRoute.route.map((swap) => swap.dex).join(" → "));
    console.log("Lucro líquido:", profitInETH.toFixed(6), baseToken.symbol);

    const swapSteps = await convertRouteToSwapSteps(bestRoute.route);
    const calls = await buildOrchestrationFromRoute(swapSteps, EXECUTOR_CONTRACTARBITRUM);

    const flashloans = [
      {
        provider: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Lending pool
        token: baseToken.address,
        amount: bestRoute.inputAmount,
      },
    ];

    try {
      const tx = await executeFlashloanBundle(contract, flashloans, calls, provider);

      console.log(`🚀 Transação enviada! Hash: ${tx.hash}`);

      await supabase.from("bot_logs").insert({
        level: "info",
        message: `Arbitragem executada com sucesso`,
        category: "transaction",
        bot_type: "arbitrage",
        source: "executor",
        tx_hash: tx.hash,
        metadata: {
          dexes: bestRoute.route.map((r) => r.dex),
          profit: profitInETH,
        },
      });
    } catch (err: any) {
      console.error("❌ Erro na execução da arbitragem:", err.message);

      await supabase.from("bot_logs").insert({
        level: "error",
        message: `Erro na arbitragem`,
        category: "exception",
        bot_type: "arbitrage",
        source: "executor",
        metadata: { error: err.message },
      });
    }
  } else {
    console.log("⚠️ Nenhuma arbitragem lucrativa encontrada.");
  }
}

async function loop() {
  while (true) {
    try {
      await executeCycle();
    } catch (err) {
      console.error("❌ Erro no loop principal:", err);
    }
    await sleep(1000); // 10 segundos entre ciclos
  }
}

loop();
