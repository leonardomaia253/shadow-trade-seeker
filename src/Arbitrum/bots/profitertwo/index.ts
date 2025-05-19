
import { ethers } from "ethers";
import "dotenv/config";
import { getProvider } from "../../config/provider";
import { buildOrchestrationFromRoute } from "./profiter2builder";
import { fetchTopTokensArbitrum } from "../../utils/tokensdefi";
import { findBestMultiHopRoute } from "./profiter2scanner";
import { TokenInfo } from "../../utils/types";
import { convertRouteToSwapSteps } from "../../utils/swapsteps";
import { createClient } from "@supabase/supabase-js";
import { executorAddress } from "@/Arbitrum/constants/addresses";
import { buildUnwrapWETHCall } from "@/Arbitrum/shared/build/UnwrapWETH";
import {getWETHBalance} from "../../shared/build/BalanceOf";
import {BigNumber, Wallet} from "ethers";
import {buildSwapToETHCall} from "../../shared/build/buildSwapResidual";
import { simulateTokenProfit, simulateTransaction } from "../../simulation/simulate";
import { sendBundle } from "@/Arbitrum/executor/sendBundle";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";
import { getTokenPrice } from "../../utils/getTokenPrice";
import { LIQUID_TOKENS } from "../../constants/tokens";

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration with defaults and environment variables
const MIN_PROFIT_ETH = parseFloat(process.env.MIN_PROFIT_ETH || "0.01");
const MAX_SLIPPAGE = parseFloat(process.env.MAX_SLIPPAGE || "0.01");  // 1% slippage máximo
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || "1000"); // intervalo de verificação em ms
const MAX_GAS_PRICE = parseFloat(process.env.MAX_GAS_PRICE || "100"); // em gwei

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
let lastSuccessfulArbitrage = 0;
let runCount = 0;
let successCount = 0;
let totalProfit = BigNumber.from(0);

// Cache de tokens e rotas anteriores bem-sucedidas
const previousSuccessfulRoutes: Map<string, { count: number, lastProfit: BigNumber }> = new Map();

// Função para verificar configurações do bot no banco de dados
async function checkBotConfig() {
  try {
    // Fetch current bot configuration from database
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running, total_profit')
      .eq('bot_type', 'profiter-two')
      .single();
      
    if (error) {
      console.error("❌ Error fetching bot configuration:", error.message);
      return;
    }
    
    // Update local running state based on database
    if (data) {
      if (isRunning !== data.is_running) {
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
          bot_type: 'profiter-two',
          source: 'system'
        });
      }

      // Sync total profit from database if needed
      if (data.total_profit) {
        const dbProfit = ethers.utils.parseUnits(data.total_profit.toString(), 18);
        if (!totalProfit.eq(dbProfit)) {
          totalProfit = dbProfit;
        }
      }
    }
  } catch (err: any) {
    console.error("❌ Failed to check bot configuration:", err.message);
  }
}

// Função para validar uma oportunidade antes da execução
async function validateOpportunity(route: any, calls: any[]) {
  try {
    // Verifica o preço atual do gás
    const gasPrice = await provider.getGasPrice();
    const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, "gwei"));
    
    if (gasPriceGwei > MAX_GAS_PRICE) {
      console.log(`⚠️ Gas price too high: ${gasPriceGwei} gwei > ${MAX_GAS_PRICE} gwei`);
      return false;
    }
    
    // Simula a transação usando Tenderly
    const bundleTxs = calls.map((tx) => ({
      signer: signer,
      transaction: {to: tx.to, data: tx.data, gasLimit: 500_000},
    }));
    
    const simulationResult = await simulateBundleWithTenderly(
      bundleTxs.map(tx => ethers.utils.serializeTransaction({
        to: tx.transaction.to,
        data: tx.transaction.data,
        gasLimit: tx.transaction.gasLimit,
        gasPrice,
        nonce: 0,
        chainId: 42161, // Arbitrum
        value: 0,
      }, {
        r: '0x',
        s: '0x',
        v: 27
      }))
    );
    
    if (!simulationResult.success) {
      console.log("❌ Simulation failed");
      return false;
    }
    
    // Valida o lucro novamente por simulação
    const profit = await simulateTokenProfit({
      provider,
      executorAddress,
      tokenAddress: route.route[0].tokenIn.address,
      calls: calls
    });
    
    const minExpectedProfit = ethers.utils.parseUnits(currentProfitThreshold.toString(), 18);
    if (profit.lt(minExpectedProfit)) {
      console.log(`⚠️ Simulated profit ${ethers.utils.formatEther(profit)} ETH below threshold ${currentProfitThreshold} ETH`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error validating opportunity:", error);
    return false;
  }
}

// Função para selecionar tokens mais prováveis para arbitragem
function selectArbitrageTokens(allTokens: TokenInfo[]) {
  // Prioriza tokens com histórico de sucesso
  const scoredTokens = allTokens.map(token => {
    const routeKey = token.address;
    const history = previousSuccessfulRoutes.get(routeKey);
    // Fix arithmetic operation error: convert BigNumber to number for calculation
    const profitValue = history && history.lastProfit ? parseFloat(ethers.utils.formatEther(history.lastProfit)) : 0;
    const score = history ? history.count * (1 + profitValue) : 0;
    return { token, score };
  });
  
  // Ordena por score
  scoredTokens.sort((a, b) => b.score - a.score);
  
  // Garante que tokens líquidos conhecidos estejam incluídos
  const liquidAddresses = new Set(LIQUID_TOKENS.map(addr => addr.toLowerCase()));
  const liquidTokens = allTokens.filter(token => liquidAddresses.has(token.address.toLowerCase()));
  
  // Combina os resultados (top scored + tokens líquidos conhecidos)
  const topScored = scoredTokens.slice(0, 20).map(item => item.token);
  const combinedTokens = [...topScored];
  
  for (const token of liquidTokens) {
    if (!combinedTokens.some(t => t.address.toLowerCase() === token.address.toLowerCase())) {
      combinedTokens.push(token);
    }
  }
  
  return combinedTokens;
}

async function executeCycle() {
  if (!isRunning) {
    await sleep(UPDATE_INTERVAL);
    return;
  }
  
  runCount++;
  
  try {
    console.log(`🔍 Ciclo #${runCount}: Buscando tokens top 200 por volume na Arbitrum...`);
    const tokenList = await fetchTopTokensArbitrum(200);

    if (tokenList.length === 0) {
      console.error("❌ Lista de tokens vazia, abortando.");
      return;
    }

    console.log(`✅ Tokens carregados: ${tokenList.length}. Rodando busca de arbitragem...`);

    // Seleciona tokens mais promissores para arbitragem
    const selectedTokens = selectArbitrageTokens(tokenList);
    console.log(`🔍 Analisando ${selectedTokens.length} tokens selecionados para arbitragem`);

    const bestRoute = await findBestMultiHopRoute({
      provider,
      baseToken: currentBaseToken,
      tokenList: selectedTokens,
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
      console.log("Lucro líquido estimado:", profitInETH.toFixed(6), currentBaseToken.symbol);

      const route = await convertRouteToSwapSteps(bestRoute.route);
      const {calls, flashLoanToken, flashLoanAmount} = await buildOrchestrationFromRoute({route, executor:executorAddress } );
      
      // Valida a oportunidade antes de executar
      const isValid = await validateOpportunity(bestRoute, calls);
      if (!isValid) {
        console.log("⚠️ Oportunidade invalidada após simulação");
        return;
      }
      
      // Estima lucro real usando simulação
      const profit = await simulateTokenProfit({
        provider,
        executorAddress,
        tokenAddress: flashLoanToken, 
        calls: calls
      });
      
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
      const Txs = [...(Array.isArray(calls) ? calls : [calls]), SwapRemainingtx, unwrapCall];

      const bundleTxs = Txs.map((tx) => ({
        signer: signer,
        transaction: {to: tx.to, data: tx.data, gasLimit: 500_000}
      }));
      
      try {
        // Envia bundle para execução
        console.log("📡 Enviando transação...");
        const bundleResult = await sendBundle(bundleTxs, provider);
        
        console.log("✅ Bundle enviado com sucesso! Aguardando confirmação...");
        
        // Registra a rota bem-sucedida no histórico
        for (const swap of bestRoute.route) {
          const tokenKey = swap.tokenIn.address;
          const existing = previousSuccessfulRoutes.get(tokenKey) || { count: 0, lastProfit: BigNumber.from(0) };
          previousSuccessfulRoutes.set(tokenKey, { 
            count: existing.count + 1, 
            lastProfit: BigNumber.from(bestRoute.netProfit)
          });
        }
        
        // Atualiza estatísticas
        successCount++;
        lastSuccessfulArbitrage = Date.now();
        totalProfit = totalProfit.add(BigNumber.from(bestRoute.netProfit));

        await supabase.from("bot_logs").insert({
          level: "info",
          message: `Arbitragem executada com sucesso`,
          category: "transaction",
          bot_type: "profiter-two",
          source: "executor",
          tx_hash: JSON.stringify(bundleTxs.map(tx => tx.transaction.to)),
          metadata: {
            dexes: bestRoute.route.map((r) => r.dex),
            profit: profitInETH,
            path: bestRoute.route.map(swap => `${swap.tokenIn.symbol} -> ${swap.tokenOut.symbol}`).join(', ')
          },
        });
        
        // Update statistics
        const { data: stats } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'profiter-two')
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
            .eq('bot_type', 'profiter-two');
            
          // Adiciona registro à tabela de transações
          await supabase
            .from('bot_transactions')
            .insert({
              bot_type: 'profiter-two',
              tx_hash: JSON.stringify(bundleTxs.map(tx => tx.transaction.to)),
              status: 'success',
              action: 'arbitrage',
              profit: profitInETH,
              gas: newGasSpent,
              timestamp: new Date().toISOString()
            });
        }
        
      } catch (err: any) {
        console.error("❌ Erro na execução da arbitragem:", err.message);

        await supabase.from("bot_logs").insert({
          level: "error",
          message: `Erro na arbitragem`,
          category: "exception",
          bot_type: "profiter-two",
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
      bot_type: "profiter-two",
      source: "system",
      metadata: { error: err.message, stack: err.stack },
    });
  }
}

// Main bot loop
async function loop() {
  console.log("🤖 Iniciando bot de arbitragem Profiter Two...");
  
  // Initial configuration load
  try {
    const { data, error } = await supabase
      .from('bot_statistics')
      .select('is_running, total_profit')
      .eq('bot_type', 'profiter-two')
      .single();
      
    if (data) {
      isRunning = data.is_running || false;
      if (data.total_profit) {
        totalProfit = ethers.utils.parseUnits(data.total_profit.toString(), 18);
      }
      console.log(`🤖 Estado inicial do bot: ${isRunning ? 'EXECUTANDO' : 'PARADO'}`);
    } else {
      // Initialize bot_statistics if it doesn't exist
      await supabase.from('bot_statistics').upsert({
        bot_type: 'profiter-two',
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
    bot_type: "profiter-two",
    source: "system",
    metadata: { 
      profitThreshold: currentProfitThreshold,
      baseToken: currentBaseToken.symbol,
      isRunning
    },
  });

  // Registra estatísticas a cada minuto
  setInterval(async () => {
    if (!isRunning) return;
    
    const successRate = runCount > 0 ? (successCount / runCount) * 100 : 0;
    
    await supabase.from("bot_logs").insert({
      level: "info",
      message: `Estatísticas do bot: ${successCount}/${runCount} ciclos bem-sucedidos (${successRate.toFixed(2)}%)`,
      category: "statistics",
      bot_type: "profiter-two",
      source: "system",
      metadata: { 
        runCount,
        successCount,
        successRate,
        totalProfit: ethers.utils.formatEther(totalProfit)
      },
    });
  }, 60000); // A cada minuto

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
    await sleep(UPDATE_INTERVAL);
  }
}

// Start the bot
loop();
