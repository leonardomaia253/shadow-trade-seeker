import { ethers } from "ethers";
import "dotenv/config";
import { createResilientProvider } from "../../config/resilientProvider";
import { buildOrchestrationFromRoute } from "./profiter2builder";
import { fetchTopTokensArbitrum } from "../../utils/tokensdefi";
import { findBestMultiHopRoute } from "./profiter2scanner";
import { TokenInfo } from "../../utils/types";
import { convertRouteToSwapSteps } from "../../utils/swapsteps";
import { createClient } from "@supabase/supabase-js";
import { executorAddress } from "@/Arbitrum/constants/addresses";
import { buildUnwrapWETHCall } from "@/Arbitrum/shared/build/UnwrapWETH";
import { getWETHBalance } from "../../shared/build/BalanceOf";
import { BigNumber, Wallet } from "ethers";
import { buildSwapToETHCall } from "../../shared/build/buildSwapResidual";
import { simulateTokenProfit, simulateTransaction } from "../../simulation/simulate";
import { sendBundle } from "@/Arbitrum/executor/sendBundle";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";
import { getTokenPrice } from "../../utils/getTokenPrice";
import { LIQUID_TOKENS } from "../../constants/tokens";
import { handleError, CircuitBreaker } from "../../utils/errorHandler";
import { validateTransaction, RateLimiter } from "../../utils/securityUtils";
import { createContextLogger } from "../../utils/enhancedLogger";
import { startHealthServer, updateBotMetrics, updateBotStatus, registerShutdownHandlers } from "../../utils/healthMonitor";
import { createBotModuleLogger, checkDependencies } from "../../utils/botLogger";
import { JsonRpcProvider } from 'ethers';

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create a context-aware logger for this bot
const log = createContextLogger({
  botType: "profiter-two",
  source: "main"
});

// Create module-specific loggers
const scannerLogger = createBotModuleLogger({
  botType: "profiter-two",
  module: "scanner",
  supabase
});

const builderLogger = createBotModuleLogger({
  botType: "profiter-two",
  module: "builder",
  supabase
});

const simulationLogger = createBotModuleLogger({
  botType: "profiter-two",
  module: "simulation",
  supabase
});

const executionLogger = createBotModuleLogger({
  botType: "profiter-two",
  module: "executor",
  supabase
});

// Configuration with defaults and environment variables
const MIN_PROFIT_ETH = parseFloat(process.env.MIN_PROFIT_ETH || "0.01");
const MAX_SLIPPAGE = parseFloat(process.env.MAX_SLIPPAGE || "0.01");  // 1% slippage máximo
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || "1000"); // intervalo de verificação em ms
const MAX_GAS_PRICE = parseFloat(process.env.MAX_GAS_PRICE || "100"); // em gwei
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "3001");

// Initialize provider and signer with resilience
const provider = createResilientProvider();
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

// Rate limiters and circuit breakers for critical operations
const scanRateLimiter = new RateLimiter(10, 60000); // 10 scans per minute
const executionRateLimiter = new RateLimiter(3, 60000); // 3 executions per minute
const scanCircuitBreaker = new CircuitBreaker(5, 120000, "profiter-two");
const simulationCircuitBreaker = new CircuitBreaker(3, 180000, "profiter-two");
const executionCircuitBreaker = new CircuitBreaker(2, 300000, "profiter-two");

// Cache for previously successful routes
const previousSuccessfulRoutes: Map<string, { count: number, lastProfit: BigNumber }> = new Map();

/**
 * Função para verificar configurações do bot no banco de dados
 */
async function checkBotConfig() {
  return handleError(
    async () => {
      // Fetch current bot configuration from database
      const { data, error } = await supabase
        .from('bot_statistics')
        .select('is_running, total_profit')
        .eq('bot_type', 'profiter-two')
        .single();
        
      if (error) {
        throw new Error(`Error fetching bot configuration: ${error.message}`);
      }
      
      // Update local running state based on database
      if (data) {
        if (isRunning !== data.is_running) {
          if (data.is_running) {
            log.info("Bot enabled from UI, starting operations", { category: "bot_state" });
            isRunning = true;
            updateBotStatus("running");
          } else {
            log.info("Bot disabled from UI, pausing operations", { category: "bot_state" });
            isRunning = false;
            updateBotStatus("stopped");
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
    },
    "checkBotConfig",
    { botType: "profiter-two", maxRetries: 3 }
  );
}

/**
 * Função para validar uma oportunidade antes da execução
 */
async function validateOpportunity(route: any, calls: any[]) {
  return simulationCircuitBreaker.execute(async () => {
    simulationLogger.logInitialization({
      routeLength: route.route.length,
      callsCount: calls.length
    });
    
    try {
      // Verifica o preço atual do gás
      const gasPrice = await provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, "gwei"));
      
      simulationLogger.logSimulation("Checking gas price", { 
        gasPriceGwei, 
        maxAllowed: MAX_GAS_PRICE 
      }, gasPriceGwei <= MAX_GAS_PRICE);
      
      if (gasPriceGwei > MAX_GAS_PRICE) {
        log.warn(`Gas price too high: ${gasPriceGwei} gwei > ${MAX_GAS_PRICE} gwei`, { 
          category: "gas", 
          currentPrice: gasPriceGwei, 
          threshold: MAX_GAS_PRICE 
        });
        return false;
      }
      
      // Validate each transaction in the calls
      simulationLogger.logSimulation("Validating transaction calls", {
        callsCount: calls.length
      }, true);
      
      for (const call of calls) {
        const validation = await validateTransaction(
          provider, 
          call.to, 
          call.data, 
          call.value || 0,
          MAX_GAS_PRICE,
          3000000
        );
        
        if (!validation.valid) {
          simulationLogger.logSimulation("Transaction validation failed", { 
            reason: validation.reason,
            to: call.to 
          }, false);
          
          log.warn(`Transaction validation failed: ${validation.reason}`, { category: "security" });
          return false;
        }
      }
      
      simulationLogger.logSimulation("All transactions validated successfully", {}, true);
      
      // Fix type issue by creating a JSON-RPC compatible transaction object
      const bundleTxs = calls.map((tx) => ({
        signer: signer,
        transaction: {to: tx.to, data: tx.data, gasLimit: 500_000},
      }));
      
      // Create serialized transactions with minimal fields required for Tenderly simulation
      simulationLogger.logSimulation("Preparing Tenderly simulation", {
        bundleSize: bundleTxs.length
      }, true);
      
      const simulationTransactions = bundleTxs.map(tx => {
        const txData = {
          to: tx.transaction.to,
          data: tx.transaction.data,
          gasLimit: tx.transaction.gasLimit,
          gasPrice: ethers.utils.parseUnits("1", "gwei").toHexString(),
          nonce: 0,
          chainId: 42161, // Arbitrum
          value: "0x0",
        };
        
        // Create a minimal transaction that doesn't require Provider fields
        return ethers.utils.serializeTransaction(txData, {
          r: "0x",
          s: "0x",
          v: 27
        });
      });
      
      simulationLogger.logSimulation("Running Tenderly simulation", {
        transactionCount: simulationTransactions.length
      }, true);
      
      // Pass only the serialized transactions array without provider parameter
      const simulationResult = await simulateBundleWithTenderly(simulationTransactions);
      
      simulationLogger.logSimulation("Tenderly simulation completed", { 
        success: simulationResult.success,
        hasError: !!simulationResult.error
      }, simulationResult.success);
      
      if (!simulationResult.success) {
        log.warn("Tenderly simulation failed", { 
          category: "simulation",
          result: simulationResult 
        });
        return false;
      }
      
      // Valida o lucro novamente por simulação
      simulationLogger.logSimulation("Simulating profit", {
        tokenAddress: route.route[0].tokenIn.address
      }, true);
      
      const profit = await simulateTokenProfit({
        provider,
        executorAddress,
        tokenAddress: route.route[0].tokenIn.address,
        calls: calls
      });
      
      const minExpectedProfit = ethers.utils.parseUnits(currentProfitThreshold.toString(), 18);
      const isProfitable = profit.gte(minExpectedProfit);
      
      simulationLogger.logSimulation("Profit simulation results", {
        simulated: ethers.utils.formatEther(profit),
        threshold: currentProfitThreshold,
        isProfitable
      }, isProfitable);
      
      if (!isProfitable) {
        log.warn(`Simulated profit ${ethers.utils.formatEther(profit)} ETH below threshold ${currentProfitThreshold} ETH`, {
          category: "profit",
          simulated: ethers.utils.formatEther(profit),
          threshold: currentProfitThreshold
        });
        return false;
      }
      
      return true;
    } catch (error: any) {
      simulationLogger.logModuleError(error, {
        operation: "validateOpportunity"
      });
      
      log.error("Error validating opportunity", {
        error: error.message,
        stack: error.stack,
        category: "validation"
      });
      return false;
    }
  }, "validateOpportunity");
}

/**
 * Função para selecionar tokens mais prováveis para arbitragem
 */
function selectArbitrageTokens(allTokens: TokenInfo[]) {
  try {
    scannerLogger.logScan("Selecting arbitrage tokens", {
      totalTokens: allTokens.length,
      historicalRoutes: previousSuccessfulRoutes.size
    });
    
    // Prioriza tokens com histórico de sucesso
    const scoredTokens = allTokens.map(token => {
      const routeKey = token.address;
      const history = previousSuccessfulRoutes.get(routeKey);
      // Safely convert BigNumber to number for calculation
      const profitValue = history && history.lastProfit 
        ? parseFloat(ethers.utils.formatEther(history.lastProfit)) 
        : 0;
      const score = history ? history.count * (1 + profitValue) : 0;
      return { token, score };
    });
    
    // Ordena por score
    scoredTokens.sort((a, b) => b.score - a.score);
    
    // Garante que tokens líquidos conhecidos estejam incluídos
    const liquidAddresses = new Set(LIQUID_TOKENS.map(addr => addr.toLowerCase()));
    const liquidTokens = allTokens.filter(token => liquidAddresses.has(token.address.toLowerCase()));
    
    scannerLogger.logScan("Liquid tokens identified", {
      liquidTokensCount: liquidTokens.length
    });
    
    // Combina os resultados (top scored + tokens líquidos conhecidos)
    const topScored = scoredTokens.slice(0, 20).map(item => item.token);
    const combinedTokens = [...topScored];
    
    for (const token of liquidTokens) {
      if (!combinedTokens.some(t => t.address.toLowerCase() === token.address.toLowerCase())) {
        combinedTokens.push(token);
      }
    }
    
    scannerLogger.logScan("Token selection completed", {
      selectedTokens: combinedTokens.length,
      topScoredCount: topScored.length,
      liquidTokensAdded: combinedTokens.length - topScored.length
    });
    
    return combinedTokens;
  } catch (error: any) {
    scannerLogger.logModuleError(error, {
      operation: "selectArbitrageTokens"
    });
    
    log.error("Error selecting arbitrage tokens", { 
      error: error.message,
      category: "token_selection"
    });
    return allTokens.slice(0, 20); // Fallback to top 20 tokens
  }
}

/**
 * Main execution cycle for finding and executing arbitrage opportunities
 */
async function executeCycle() {
  if (!isRunning) {
    await sleep(UPDATE_INTERVAL);
    return;
  }
  
  // Check rate limiting
  if (!scanRateLimiter.isAllowed("arbitrage_scan")) {
    log.warn("Rate limit reached for arbitrage scanning", { 
      category: "rate_limit",
      operation: "arbitrage_scan" 
    });
    await sleep(UPDATE_INTERVAL);
    return;
  }
  
  runCount++;
  updateBotMetrics({
    cyclesRun: runCount,
    successfulTransactions: successCount,
    failedTransactions: runCount - successCount,
    totalProfit: ethers.utils.formatEther(totalProfit)
  });
  
  try {
    return await scanCircuitBreaker.execute(async () => {
      log.info(`Cycle #${runCount}: Fetching top trading tokens on Arbitrum...`, { 
        category: "scan",
        cycle: runCount 
      });
      
      scannerLogger.logScan("Starting token fetch", {
        cycle: runCount,
        timestamp: new Date().toISOString()
      });
      
      const tokenList = await fetchTopTokensArbitrum(200);

      if (tokenList.length === 0) {
        scannerLogger.logModuleError(new Error("Empty token list returned"), {
          operation: "fetchTopTokensArbitrum"
        });
        
        log.error("Empty token list, aborting cycle", { category: "scan" });
        return;
      }

      scannerLogger.logScan("Tokens loaded successfully", { 
        tokenCount: tokenList.length 
      });
      
      log.info(`Tokens loaded: ${tokenList.length}. Running arbitrage search...`, { 
        category: "scan",
        tokenCount: tokenList.length 
      });

      // Select most promising tokens for arbitrage
      const selectedTokens = selectArbitrageTokens(tokenList);
      
      log.info(`Analyzing ${selectedTokens.length} selected tokens for arbitrage`, { 
        category: "scan",
        selectedCount: selectedTokens.length 
      });

      scannerLogger.logScan("Starting multi-hop route search", {
        baseToken: currentBaseToken.symbol,
        selectedTokens: selectedTokens.length
      });

      const bestRoute = await findBestMultiHopRoute({
        provider,
        baseToken: currentBaseToken,
        tokenList: selectedTokens,
      });

      if (bestRoute) {
        const profitInETH = parseFloat(ethers.utils.formatUnits(bestRoute.netProfit, currentBaseToken.decimals));

        scannerLogger.logScan("Route search completed", {
          foundProfitableRoute: true,
          profitInETH,
          threshold: currentProfitThreshold,
          isProfitable: profitInETH >= currentProfitThreshold,
          hopCount: bestRoute.route.length
        });

        if (profitInETH < currentProfitThreshold) {
          log.info(`Profit ${profitInETH} ETH below minimum threshold. Ignoring...`, { 
            category: "profit",
            found: profitInETH,
            threshold: currentProfitThreshold 
          });
          return;
        }

        log.info("Best arbitrage route found", {
          category: "opportunity",
          path: bestRoute.route.map(swap => `${swap.tokenIn.symbol} -> ${swap.tokenOut.symbol}`),
          dexes: bestRoute.route.map(swap => swap.dex),
          profit: profitInETH.toFixed(6)
        });

        // Check execution rate limiting
        if (!executionRateLimiter.isAllowed("arbitrage_execution")) {
          log.warn("Rate limit reached for arbitrage execution", { 
            category: "rate_limit",
            operation: "arbitrage_execution" 
          });
          return;
        }

        builderLogger.logInitialization({
          routeSize: bestRoute.route.length,
          estimatedProfit: profitInETH
        });
        
        builderLogger.logBuild("Converting route to swap steps", {
          route: bestRoute.route.map(swap => ({
            tokenIn: swap.tokenIn.symbol,
            tokenOut: swap.tokenOut.symbol,
            dex: swap.dex
          }))
        });
        
        const route = await convertRouteToSwapSteps(bestRoute.route);
        
        builderLogger.logBuild("Building orchestration from route", {
          swapSteps: route.length,
          executor: executorAddress
        });
        
        const {calls, flashLoanToken, flashLoanAmount} = await buildOrchestrationFromRoute({route, executor:executorAddress });
        
        builderLogger.logBuild("Orchestration built successfully", {
          callsCount: Array.isArray(calls) ? calls.length : 1,
          flashLoanToken,
          flashLoanAmount: flashLoanAmount.toString()
        });
        
        // Validate opportunity before executing
        const isValid = await validateOpportunity(bestRoute, calls);
        if (!isValid) {
          log.warn("Opportunity invalidated after simulation", { category: "validation" });
          return;
        }
        
        // Estimate actual profit using simulation
        simulationLogger.logSimulation("Estimating final profit", {
          tokenAddress: flashLoanToken
        }, true);
        
        const profit = await simulateTokenProfit({
          provider,
          executorAddress,
          tokenAddress: flashLoanToken, 
          calls: calls
        });
        
        // Build call to swap remaining profit to ETH
        executionLogger.logInitialization({
          tokenAddress: flashLoanToken,
          profit: profit.toString()
        });
        
        executionLogger.logExecution("Building swap to ETH call", {
          tokenIn: flashLoanToken,
          amountIn: profit.toString(),
          recipient: executorAddress
        }, true);
        
        const SwapRemainingtx = await buildSwapToETHCall({ 
          tokenIn: flashLoanToken, 
          amountIn: profit, 
          recipient: executorAddress 
        });
        
        // Get WETH balance for unwrapping
        executionLogger.logExecution("Getting WETH balance for unwrap", {}, true);
        const wethBalanceRaw = await getWETHBalance({ provider });
        // Handle whether wethBalanceRaw is string or BigNumber
        let wethBalance: BigNumber;
        try {
          wethBalance = typeof wethBalanceRaw === 'string' && !wethBalanceRaw.startsWith('0x')
            ? ethers.utils.parseEther(wethBalanceRaw)
            : BigNumber.from(wethBalanceRaw);
        } catch {
          wethBalance = BigNumber.from(wethBalanceRaw);
        }
        
        executionLogger.logExecution("Building unwrap WETH call", {
          wethBalance: wethBalance.toString()
        }, true);
        
        const unwrapCall = buildUnwrapWETHCall({ amount: wethBalance });
        
        // Build final transaction bundle
        const Txs = [...(Array.isArray(calls) ? calls : [calls]), SwapRemainingtx, unwrapCall];

        const bundleTxs = Txs.map((tx) => ({
          signer: signer,
          transaction: {to: tx.to, data: tx.data, gasLimit: 500_000}
        }));
        
        executionLogger.logExecution("Bundle prepared for execution", {
          transactionsCount: bundleTxs.length
        }, true);
        
        try {
          return await executionCircuitBreaker.execute(async () => {
            // Send bundle for execution
            log.info("Sending transaction bundle...", { category: "execution" });
            
            executionLogger.logExecution("Sending transaction bundle", {
              transactionCount: bundleTxs.length
            }, true);
            
            const bundleResult = await sendBundle(bundleTxs, provider);
            
            executionLogger.logExecution("Bundle sent successfully", {
              bundleResult
            }, true);
            
            log.info("Bundle sent successfully! Awaiting confirmation...", { 
              category: "execution",
              bundleResult 
            });
            
            // Record successful route in history
            for (const swap of bestRoute.route) {
              const tokenKey = swap.tokenIn.address;
              const existing = previousSuccessfulRoutes.get(tokenKey) || { count: 0, lastProfit: BigNumber.from(0) };
              previousSuccessfulRoutes.set(tokenKey, { 
                count: existing.count + 1, 
                lastProfit: BigNumber.from(bestRoute.netProfit)
              });
            }
            
            // Update statistics
            successCount++;
            lastSuccessfulArbitrage = Date.now();
            totalProfit = totalProfit.add(BigNumber.from(bestRoute.netProfit));

            executionLogger.logExecution("Transaction executed successfully", {
              profit: profitInETH,
              path: bestRoute.route.map(swap => `${swap.tokenIn.symbol} -> ${swap.tokenOut.symbol}`).join(', ')
            }, true);

            await supabase.from("bot_logs").insert({
              level: "info",
              message: `Arbitrage executed successfully`,
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
                
              // Add record to transactions table
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
            
            updateBotMetrics({
              successfulTransactions: successCount,
              totalProfit: ethers.utils.formatEther(totalProfit)
            });
            
            return true;
          }, "executeArbitrage");
        } catch (err: any) {
          executionLogger.logModuleError(err, {
            operation: "sendBundle"
          });
          
          log.error("Error executing arbitrage", {
            category: "execution",
            error: err.message,
            stack: err.stack
          });

          await supabase.from("bot_logs").insert({
            level: "error",
            message: `Arbitrage execution error: ${err.message}`,
            category: "exception",
            bot_type: "profiter-two",
            source: "executor",
            metadata: { error: err.message, stack: err.stack },
          });
          
          return false;
        }
      } else {
        scannerLogger.logScan("No profitable arbitrage found", {
          cycle: runCount
        });
        
        log.info("No profitable arbitrage found in this cycle", { category: "scan" });
        return false;
      }
    }, "executeCycle");
  } catch (err: any) {
    log.error("Error in execution cycle", {
      category: "exception",
      error: err.message,
      stack: err.stack
    });
    
    // Log any unexpected errors
    await supabase.from("bot_logs").insert({
      level: "error",
      message: `Execution cycle error: ${err.message}`,
      category: "exception",
      bot_type: "profiter-two",
      source: "system",
      metadata: { error: err.message, stack: err.stack },
    });
    
    return false;
  }
}

// Graceful shutdown handler
async function gracefulShutdown() {
  try {
    log.info("Performing graceful shutdown", { category: "system" });
    
    // Update bot status
    updateBotStatus("stopped");
    
    // Log shutdown to database
    await supabase.from("bot_logs").insert({
      level: "info",
      message: "Bot shutting down gracefully",
      category: "bot_state",
      bot_type: "profiter-two",
      source: "system"
    });
    
    // Any additional cleanup can be done here
    
    log.info("Shutdown complete", { category: "system" });
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
}

// Main bot loop
async function loop() {
  try {
    log.info("Starting Profiter Two arbitrage bot", { category: "startup" });
    
    // Start health monitoring server
    startHealthServer(HEALTH_PORT);
    
    // Register shutdown handlers
    registerShutdownHandlers(gracefulShutdown);
    
    // Initialize all loggers
    scannerLogger.logInitialization({
      timestamp: new Date().toISOString()
    });
    
    builderLogger.logInitialization({
      timestamp: new Date().toISOString()
    });
    
    simulationLogger.logInitialization({
      timestamp: new Date().toISOString()
    });
    
    executionLogger.logInitialization({
      timestamp: new Date().toISOString()
    });
    
    // Check critical dependencies
    await checkDependencies({
      botType: "profiter-two",
      provider,
      supabase,
      dependencies: [
        {
          name: "flashloan-contracts",
          check: async () => {
            try {
              const code = await provider.getCode(executorAddress);
              return code !== '0x';
            } catch {
              return false;
            }
          }
        },
        {
          name: "tenderly-api",
          check: async () => {
            try {
              const testTx = ethers.utils.serializeTransaction({
                to: executorAddress,
                data: "0x",
                gasLimit: 100000,
                gasPrice: ethers.utils.parseUnits("1", "gwei").toHexString(),
                nonce: 0,
                chainId: 42161,
                value: "0x0",
              }, { r: "0x", s: "0x", v: 27 });
              
              // Fix: Only pass the serialized transaction array, no provider parameter
              const result = await simulateBundleWithTenderly([testTx]);
              return result.success || result.results !== undefined;
            } catch {
              return false;
            }
          }
        },
        {
          name: "supabase-connection",
          check: async () => {
            try {
              const { error } = await supabase.from('bot_statistics').select('id').limit(1);
              return !error;
            } catch {
              return false;
            }
          }
        }
      ]
    });
    
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
        updateBotStatus(isRunning ? "running" : "stopped");
        log.info(`Initial bot state: ${isRunning ? 'RUNNING' : 'STOPPED'}`, { 
          category: "bot_state" 
        });
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
      log.error("Error initializing bot state", {
        category: "startup",
        error: err.message
      });
    }
    
    // Log bot startup
    await supabase.from("bot_logs").insert({
      level: "info",
      message: `Bot started with configuration: Profit min=${currentProfitThreshold} ETH, Base token=${currentBaseToken.symbol}`,
      category: "bot_state",
      bot_type: "profiter-two",
      source: "system",
      metadata: { 
        profitThreshold: currentProfitThreshold,
        baseToken: currentBaseToken.symbol,
        isRunning
      },
    });

    // Register statistics logging interval
    setInterval(async () => {
      if (!isRunning) return;
      
      const successRate = runCount > 0 ? (successCount / runCount) * 100 : 0;
      
      await supabase.from("bot_logs").insert({
        level: "info",
        message: `Bot statistics: ${successCount}/${runCount} cycles successful (${successRate.toFixed(2)}%)`,
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
      
      // Update metrics for health monitoring
      updateBotMetrics({
        cyclesRun: runCount,
        successfulTransactions: successCount,
        failedTransactions: runCount - successCount,
        totalProfit: ethers.utils.formatEther(totalProfit)
      });
    }, 60000); // Every minute

    // Main processing loop
    while (true) {
      try {
        // Check for configuration changes from UI
        await checkBotConfig();
        
        // Run execution cycle if bot is enabled
        if (isRunning) {
          await executeCycle();
        }
      } catch (err) {
        log.error("Error in main loop", {
          category: "exception",
          error: err.message,
          stack: err instanceof Error ? err.stack : undefined
        });
      }
      await sleep(UPDATE_INTERVAL);
    }
  } catch (err) {
    log.critical("Fatal error in bot initialization", {
      category: "exception",
      error: err.message,
      stack: err instanceof Error ? err.stack : undefined
    });
    process.exit(1);
  }
}

// Start the bot
loop();
