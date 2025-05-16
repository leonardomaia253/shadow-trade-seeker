
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.1";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to start the arbitrage bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold } = config;

  // Log bot start event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Arbitrage bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    category: 'bot_state',
    bot_type: 'arbitrage',
    source: 'system',
    metadata: { baseToken, profitThreshold }
  });
  
  // Log additional startup information
  await supabase.from('bot_logs').insert({
    level: 'debug',
    message: 'Initializing price feeds and swap routes',
    category: 'initialization',
    bot_type: 'arbitrage',
    source: 'system',
    metadata: { 
      poolsLoaded: 32,
      supportedDEXs: ['Uniswap', 'SushiSwap', 'Curve', 'Balancer'],
      networkID: 42161
    }
  });
  
  // Update bot status
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');

  // In a real implementation, we would trigger actual bot execution here
  // For demo: simulate bot activity by scheduling some transactions
  simulateArbitrageTransactions(supabase);
  
  return { success: true, message: "Bot started successfully" };
}

// Function to stop the arbitrage bot
async function stopBot(supabase) {
  // Log bot stop event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Arbitrage bot stopped',
    category: 'bot_state',
    bot_type: 'arbitrage',
    source: 'system'
  });
  
  // Update bot status
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');
  
  return { success: true, message: "Bot stopped successfully" };
}

// For demonstration purposes: simulate bot transactions
async function simulateArbitrageTransactions(supabase) {
  const dexes = ["Uniswap", "SushiSwap", "Curve", "Balancer"];
  const tokens = ["USDC", "WETH", "USDT", "ARB", "LINK"];
  
  // Simulate a few transactions over time
  for (let i = 0; i < 5; i++) {
    // Wait random time between transactions (1-8 seconds)
    await new Promise(r => setTimeout(r, Math.random() * 7000 + 1000));
    
    // Random parameters
    const isSuccess = Math.random() > 0.3; // 70% success rate
    const profit = isSuccess ? (Math.random() * 0.02 + 0.001) : 0;
    const gas = Math.random() * 0.005 + 0.001;
    const net = profit - gas;
    
    const fromToken = tokens[Math.floor(Math.random() * tokens.length)];
    const toToken = tokens[Math.floor(Math.random() * tokens.length)];
    const dex = dexes[Math.floor(Math.random() * dexes.length)];
    
    // Generate random transaction hash
    const txHash = "0x" + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Add log entries for the transaction
    const logLevel = isSuccess ? 'info' : (Math.random() > 0.5 ? 'warn' : 'error');
    const logMessage = isSuccess
      ? `Successful arbitrage: ${fromToken} → ${toToken} via ${dex} with profit ${profit.toFixed(6)} ETH`
      : `Failed arbitrage attempt: ${fromToken} → ${toToken} via ${dex}`;
      
    await supabase.from('bot_logs').insert({
      level: logLevel,
      message: logMessage,
      category: 'transaction',
      bot_type: 'arbitrage',
      source: 'executor',
      tx_hash: isSuccess ? txHash : undefined,
      metadata: {
        fromToken,
        toToken,
        dex,
        profit: profit.toFixed(6),
        gas: gas.toFixed(6),
        net: net.toFixed(6),
        success: isSuccess,
        timestamp: new Date().toISOString()
      }
    });
    
    // If it failed, add an error log
    if (!isSuccess) {
      const errorReasons = [
        'Insufficient liquidity in pool',
        'Price slippage too high',
        'Transaction reverted',
        'Gas price spike',
        'Route became unprofitable'
      ];
      
      const errorReason = errorReasons[Math.floor(Math.random() * errorReasons.length)];
      
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Arbitrage error: ${errorReason}`,
        category: 'error',
        bot_type: 'arbitrage',
        source: 'executor',
        metadata: {
          reason: errorReason,
          fromToken,
          toToken,
          dex
        }
      });
      
      // Add debug log with technical details
      await supabase.from('bot_logs').insert({
        level: 'debug',
        message: `Technical details for failed transaction`,
        category: 'debug',
        bot_type: 'arbitrage',
        source: 'executor',
        metadata: {
          gasPrice: Math.floor(Math.random() * 100) + 50 + ' gwei',
          blockNumber: Math.floor(Math.random() * 1000000) + 10000000,
          nodeResponse: {
            code: Math.floor(Math.random() * 100) + 1,
            message: `Error: ${errorReason} at block #${Math.floor(Math.random() * 1000000) + 10000000}`
          }
        }
      });
    }
    
    // Record transaction
    await supabase.from('bot_transactions').insert({
      id: crypto.randomUUID(),
      bot_type: 'arbitrage',
      tx_hash: txHash,
      status: isSuccess ? 'success' : 'failed',
      profit: profit,
      action: `Arbitrage ${fromToken}→${toToken} via ${dex}`,
      gas: gas,
      protocol: dex
    });
    
    // Update statistics if successful
    if (isSuccess) {
      const { data: stats } = await supabase
        .from('bot_statistics')
        .select('*')
        .eq('bot_type', 'arbitrage')
        .single();
      
      if (stats) {
        const newTotalProfit = (parseFloat(stats.total_profit) || 0) + profit;
        const newTxCount = (parseInt(stats.transactions_count) || 0) + 1;
        const newGasSpent = (parseFloat(stats.gas_spent) || 0) + gas;
        const successfulTxs = Math.round(newTxCount * (parseFloat(stats.success_rate) || 0) / 100) + 1;
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
    } else {
      // Just update counts for failed transactions
      const { data: stats } = await supabase
        .from('bot_statistics')
        .select('transactions_count, success_rate, gas_spent')
        .eq('bot_type', 'arbitrage')
        .single();
      
      if (stats) {
        const newTxCount = (parseInt(stats.transactions_count) || 0) + 1;
        const successfulTxs = Math.round(newTxCount * (parseFloat(stats.success_rate) || 0) / 100);
        const newSuccessRate = (successfulTxs / newTxCount) * 100;
        const newGasSpent = (parseFloat(stats.gas_spent) || 0) + gas;
        
        await supabase
          .from('bot_statistics')
          .update({
            transactions_count: newTxCount,
            success_rate: newSuccessRate,
            gas_spent: newGasSpent,
            updated_at: new Date().toISOString()
          })
          .eq('bot_type', 'arbitrage');
      }
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get request body
    const { action, config } = await req.json();
    
    let result;
    
    // Handle different actions
    switch (action) {
      case 'start':
        result = await startBot(supabase, config);
        break;
      case 'stop':
        result = await stopBot(supabase);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Return success response
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    // Log error
    console.error('Error in arbitrage-bot-control:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'An error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
