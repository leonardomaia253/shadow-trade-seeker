
import { ethers } from "ethers";
import "dotenv/config";
import { getProvider } from "../../config/provider";
import { buildOrchestrationFromRoute } from "./profiterbuilder";
import { fetchTopTokensArbitrum } from "../../utils/tokensdefi";
import { findBestMultiHopRoute } from "./profiter1scanner";
import { TokenInfo } from "../../utils/types";
import { convertRouteToSwapSteps } from "../../utils/swapsteps";
import { createClient } from "@supabase/supabase-js";
import { executorAddress } from "@/Arbitrum/constants/addresses";
import { buildUnwrapWETHCall } from "@/Arbitrum/shared/build/UnwrapWETH";
import {getWETHBalance} from "../../shared/build/BalanceOf";
import {BigNumber, Wallet} from "ethers";
import {buildSwapToETHCall} from "../../shared/build/buildSwapResidual";
import { simulateTokenProfit } from "../../simulation/simulate";
import { sendBundle } from "@/Arbitrum/executor/sendBundle";

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration with defaults and environment variables
const MIN_PROFIT_ETH = parseFloat(process.env.MIN_PROFIT_ETH || "0.01");

// Initialize provider and signer
const provider = new ethers.providers.WebSocketProvider(process.env.ALCHEMY_WSS!);
const signer = new Wallet(process.env.PRIVATE_KEY!, provider);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bot state tracking
let isRunning = false;
let currentBaseToken: TokenInfo = {
  address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
  symbol: "WETH",
  decimals: 18,
};
let currentProfitThreshold = MIN_PROFIT_ETH;

// Function to report module health status
async function reportModuleStatus(module: string, status: 'ok' | 'error' | 'warning' | 'inactive', details: any = {}) {
  try {
    const silentErrors = details.silent_errors || [];
    const needsFix = silentErrors.length > 0 || status === 'error';
    
    await supabase.from('bot_logs').insert({
      level: status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'info',
      message: `${module} status: ${status}`,
      category: 'health_check',
      bot_type: 'profiter-one',
      source: module,
      timestamp: new Date().toISOString(),
      metadata: {
        status,
        health: needsFix ? 'needs_fix' : status,
        details,
        silent_errors: silentErrors,
        needsAttention: needsFix
      }
    });
  } catch (err: any) {
    console.error(`Failed to report ${module} status:`, err.message);
  }
}

// Function to check for bot configuration changes
async function checkBotConfig() {
  try {
    // Fetch current bot configuration from database
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running')
      .eq('bot_type', 'profiter-one')
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
        bot_type: 'profiter-one',
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
    // Report module health at the start of execution cycle
    await reportModuleStatus('scanner', 'ok', { details: 'Scanner running' });

    console.log("🔍 Buscando tokens top 200 por volume na Arbitrum...");
    const tokenList = await fetchTopTokensArbitrum(200);

    if (tokenList.length === 0) {
      console.error("❌ Lista de tokens vazia, abortando.");
      await reportModuleStatus('scanner', 'warning', { 
        details: 'Empty token list', 
        silent_errors: [{ 
          message: 'Empty token list received from API', 
          timestamp: new Date().toISOString(), 
          code: 'EMPTY_LIST' 
        }]
      });
      return;
    }

    console.log(`✅ Tokens carregados: ${tokenList.length}. Rodando busca de arbitragem...`);

    const bestRoute = await findBestMultiHopRoute({
      provider,
      baseToken: currentBaseToken,
      tokenList,
    });

    // Report builder status
    await reportModuleStatus('builder', 'ok', { details: 'Builder processing route' });

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

      const route = await convertRouteToSwapSteps(bestRoute.route);
      const {calls, flashLoanToken, flashLoanAmount} = await buildOrchestrationFromRoute({route, executor:executorAddress } );
      const profit = await simulateTokenProfit({provider,executorAddress,tokenAddress: flashLoanToken, calls: calls});
      
      // Report executor status
      await reportModuleStatus('executor', 'ok', { details: 'Executor preparing transaction' });
      
      // Monta a chamada para trocar lucro residual para ETH
      const SwapRemainingtx = await buildSwapToETHCall({ tokenIn: flashLoanToken, amountIn: profit, recipient:executorAddress });
      
      // Obtém saldo WETH para unwrap
      const wethBalanceRaw = await getWETHBalance({ provider });
      // Se o saldo for string decimal, usa parseEther, senão converte para BigNumber diretamente
      let wethBalance: BigNumber;
      try {
      wethBalance = ethers.utils.parseEther(wethBalanceRaw);
      } catch {
      wethBalance = BigNumber.from(wethBalanceRaw);
      }
      
      const unwrapCall = buildUnwrapWETHCall({ amount: wethBalance });
      
      // Monta o bundle final
      const Txs = [...(Array.isArray(calls) ? calls : [calls]),SwapRemainingtx,unwrapCall];

      const bundleTxs = Txs.map((tx) => ({
        signer: signer,
        transaction: {
          to: tx.to,
          data: tx.data,
          gasLimit: 500_000,
        }
      }));
      
      await sendBundle(bundleTxs, provider);
      
      try {
        await supabase.from("bot_logs").insert({
          level: "info",
          message: `Arbitragem executada com sucesso`,
          category: "transaction",
          bot_type: "profiter-one",
          source: "executor",
          tx_hash: bundleTxs,
          metadata: {
            dexes: bestRoute.route.map((r) => r.dex),
            profit: profitInETH,
          },
        });
        
        // Update statistics
        const { data: stats } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'profiter-one')
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
            .eq('bot_type', 'profiter-one');
        }
        
      } catch (err: any) {
        console.error("❌ Erro na execução da arbitragem:", err.message);

        await reportModuleStatus('executor', 'error', {
          details: 'Transaction execution error',
          silent_errors: [{
            message: `Error in arbitrage execution: ${err.message}`,
            timestamp: new Date().toISOString(),
            code: 'TX_FAIL'
          }]
        });

        await supabase.from("bot_logs").insert({
          level: "error",
          message: `Erro na arbitragem`,
          category: "exception",
          bot_type: "profiter-one",
          source: "executor",
          metadata: { error: err.message },
        });
      }
    } else {
      console.log("⚠️ Nenhuma arbitragem lucrativa encontrada.");
    }
  } catch (err: any) {
    console.error("❌ Erro no ciclo de execução:", err.message);
    
    // Report error in the appropriate module
    const errorModule = err.message.includes('scanner') ? 'scanner' : 
                       err.message.includes('builder') ? 'builder' : 
                       err.message.includes('executor') ? 'executor' : 'system';
    
    await reportModuleStatus(errorModule, 'error', {
      details: 'Execution cycle error',
      silent_errors: [{
        message: `Error in execution cycle: ${err.message}`,
        timestamp: new Date().toISOString(),
        code: 'CYCLE_ERROR'
      }]
    });
    
    // Log any unexpected errors
    await supabase.from("bot_logs").insert({
      level: "error",
      message: `Erro no ciclo de execução: ${err.message}`,
      category: "exception",
      bot_type: "profiter-one",
      source: "system",
      metadata: { error: err.message, stack: err.stack },
    });
  }
}

// Check watcher status every minute
async function checkWatcherStatus() {
  if (isRunning) {
    await reportModuleStatus('watcher', 'ok', { 
      details: 'Watcher monitoring system' 
    });
  }
  
  setTimeout(checkWatcherStatus, 60000);
}

// Main bot loop
async function loop() {
  console.log("🤖 Iniciando bot de arbitragem...");
  
  // Initial configuration load
  try {
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running')
      .eq('bot_type', 'profiter-one')
      .single();
      
    if (data) {
      isRunning = data.is_running || false;
      console.log(`🤖 Estado inicial do bot: ${isRunning ? 'EXECUTANDO' : 'PARADO'}`);
    } else {
      // Initialize bot_statistics if it doesn't exist
      await supabase.from('bot_statistics').upsert({
        bot_type: 'profiter-one',
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
    bot_type: "profiter-one",
    source: "system",
    metadata: { 
      profitThreshold: currentProfitThreshold,
      baseToken: currentBaseToken.symbol,
      isRunning
    },
  });

  // Initialize module status
  await reportModuleStatus('scanner', 'inactive', { details: 'Scanner waiting for activation' });
  await reportModuleStatus('builder', 'inactive', { details: 'Builder waiting for activation' });
  await reportModuleStatus('executor', 'inactive', { details: 'Executor waiting for activation' });
  await reportModuleStatus('watcher', 'inactive', { details: 'Watcher waiting for activation' });

  // Start watcher status check
  checkWatcherStatus();

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
      
      // Report system error
      await reportModuleStatus('system', 'error', {
        details: 'Main loop error',
        silent_errors: [{
          message: `Error in main loop: ${err.message}`,
          timestamp: new Date().toISOString(),
          code: 'LOOP_ERROR'
        }]
      });
    }
    await sleep(1000); // Poll every second
  }
}

// Start the bot
loop();
