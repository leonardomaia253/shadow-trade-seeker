
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
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration with defaults and environment variables
const MIN_PROFIT_ETH = parseFloat(process.env.MIN_PROFIT_ETH || "0.01");

// Initialize provider and signer
const provider = new ethers.providers.WebSocketProvider(process.env.ALCHEMY_WSS!);
const privateKey = process.env.PRIVATE_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bot state tracking
let isRunning = false;
let currentBaseToken: TokenInfo = {
  address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
  symbol: "WETH",
  decimals: 18,
};
let currentProfitThreshold = MIN_PROFIT_ETH;

// Function to check for bot configuration changes
async function checkBotConfig() {
  try {
    // Fetch current bot configuration from database
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running')
      .eq('bot_type', 'arbitrage')
      .single();
      
    if (error) {
      console.error("❌ Error fetching bot configuration:", error.message);
      return;
    }
    
    // Update local running state based on database
    if (data && isRunning !== data.is_running) {
      if (data.is_running) {
        console.log("🟢 Bot enabled from UI, starting operations...");
        isRunning = true;
      } else {
        console.log("🔴 Bot disabled from UI, pausing operations...");
        isRunning = false;
      }
      
      // Log the state change
      await supabase.from('bot_logs').insert({
        level: isRunning ? 'info' : 'warn',
        message: isRunning ? 'Bot started via UI control' : 'Bot stopped via UI control',
        category: 'bot_state',
        bot_type: 'arbitrage',
        source: 'system'
      });
    }
    
    // Check for configuration changes (like base token or profit threshold)
    // This could be extended based on what configuration options are available in the UI
    
  } catch (err: any) {
    console.error("❌ Failed to check bot configuration:", err.message);
  }
}

async function executeCycle() {
  if (!isRunning) {
    await sleep(1000);
    return;
  }
  
  try {
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
      baseToken: currentBaseToken,
      tokenList,
    });

    if (bestRoute) {
      const profitInETH = parseFloat(ethers.utils.formatUnits(bestRoute.netProfit, currentBaseToken.decimals));

      if (profitInETH < currentProfitThreshold) {
        console.log(`⚠️ Lucro ${profitInETH} ETH abaixo do mínimo. Ignorando...`);
        return;
      }

      console.log("✅ Melhor rota de arbitragem encontrada:");
      console.log(
        "Caminho:",
        bestRoute.route.map((swap) => swap.tokenIn.symbol).join(" → ") + " → " + bestRoute.route.at(-1)?.tokenOut.symbol
      );
      console.log("DEXs:", bestRoute.route.map((swap) => swap.dex).join(" → "));
      console.log("Lucro líquido:", profitInETH.toFixed(6), currentBaseToken.symbol);

      const swapSteps = await convertRouteToSwapSteps(bestRoute.route);
      const calls = await buildOrchestrationFromRoute(swapSteps, EXECUTOR_CONTRACTARBITRUM);

      const flashloans = [
        {
          provider: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Lending pool
          token: currentBaseToken.address,
          amount: bestRoute.inputAmount,
        },
      ];

      try {
        // Execute the bundle and capture the returned transaction
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
        
        // Update statistics
        const { data: stats } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .single();
          
        if (stats) {
          const newTotalProfit = (parseFloat(stats.total_profit.toString()) || 0) + profitInETH;
          const newTxCount = (parseInt(stats.transactions_count.toString()) || 0) + 1;
          const newGasSpent = (parseFloat(stats.gas_spent.toString()) || 0) + 0.001; // Estimate gas cost
          const successfulTxs = Math.round(newTxCount * (parseFloat(stats.success_rate.toString()) || 0) / 100) + 1;
          const newSuccessRate = (successfulTxs / newTxCount) * 100;
          const newAvgProfit = newTotalProfit / successfulTxs;
          
          await supabase
            .from('bot_statistics')
            .update({
              total_profit: newTotalProfit,
              success_rate: newSuccessRate,
              average_profit: newAvgProfit,
              gas_spent: newGasSpent,
              transactions_count: newTxCount,
              updated_at: new Date().toISOString()
            })
            .eq('bot_type', 'arbitrage');
        }
        
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
  } catch (err: any) {
    console.error("❌ Erro no ciclo de execução:", err.message);
    
    // Log any unexpected errors
    await supabase.from("bot_logs").insert({
      level: "error",
      message: `Erro no ciclo de execução: ${err.message}`,
      category: "exception",
      bot_type: "arbitrage",
      source: "system",
      metadata: { error: err.message, stack: err.stack },
    });
  }
}

// Main bot loop
async function loop() {
  console.log("🤖 Iniciando bot de arbitragem...");
  
  // Initial configuration load
  try {
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running')
      .eq('bot_type', 'arbitrage')
      .single();
      
    if (data) {
      isRunning = data.is_running || false;
      console.log(`🤖 Estado inicial do bot: ${isRunning ? 'EXECUTANDO' : 'PARADO'}`);
    } else {
      // Initialize bot_statistics if it doesn't exist
      await supabase.from('bot_statistics').upsert({
        bot_type: 'arbitrage',
        is_running: false,
        total_profit: 0,
        success_rate: 0,
        average_profit: 0,
        gas_spent: 0,
        transactions_count: 0,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error("❌ Error initializing bot state:", err);
  }
  
  // Log bot startup
  await supabase.from("bot_logs").insert({
    level: "info",
    message: `Bot iniciado com configuração: Profit min=${currentProfitThreshold} ETH, Base token=${currentBaseToken.symbol}`,
    category: "bot_state",
    bot_type: "arbitrage",
    source: "system",
    metadata: { 
      profitThreshold: currentProfitThreshold,
      baseToken: currentBaseToken.symbol,
      isRunning
    },
  });

  while (true) {
    try {
      // Check for configuration changes from UI
      await checkBotConfig();
      
      // Run execution cycle if bot is enabled
      if (isRunning) {
        await executeCycle();
      }
    } catch (err) {
      console.error("❌ Erro no loop principal:", err);
    }
    await sleep(1000); // Poll every second
  }
}

// Start the bot
loop();
