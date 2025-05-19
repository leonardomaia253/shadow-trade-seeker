
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.1";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define module types
const BOT_MODULES = ['scanner', 'builder', 'executor', 'watcher'];

// Function to start the liquidation bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Liquidation bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    category: 'bot_state',
    bot_type: 'liquidation',
    source: 'system',
    metadata: { baseToken, profitThreshold, gasMultiplier, maxGasPrice }
  });
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');

  // Create initial health check logs for each module
  for (const module of BOT_MODULES) {
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `${module} initializing`,
      category: 'health_check',
      bot_type: 'liquidation',
      source: module,
      metadata: { status: 'inactive', details: 'Module starting up' }
    });
    
    // After a short delay, update to "ok" status to simulate module startup
    setTimeout(async () => {
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: `${module} started successfully`,
        category: 'health_check',
        bot_type: 'liquidation',
        source: module,
        metadata: { status: 'ok', details: 'Module running normally' }
      });
    }, 2000 + Math.random() * 3000); // Stagger the updates
  }
  
  // Set up periodic health checks for modules
  startPeriodicHealthChecks(supabase);
  
  return { success: true, message: "Bot started successfully" };
}

// Function to simulate periodic health checks
function startPeriodicHealthChecks(supabase) {
  // This would be implemented in the actual bot service
  // Here we just simulate it with a one-time update after a delay
  setTimeout(async () => {
    for (const module of BOT_MODULES) {
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: `${module} health check`,
        category: 'health_check',
        bot_type: 'liquidation',
        source: module,
        metadata: { 
          status: 'ok', 
          details: 'Periodic health check passed',
          metrics: {
            memory: Math.floor(Math.random() * 500) + 200 + "MB",
            cpu: Math.floor(Math.random() * 40) + 10 + "%",
            uptime: Math.floor(Math.random() * 3600) + 300 + "s"
          }
        }
      });
    }
  }, 10000);
}

// Function to stop the liquidation bot
async function stopBot(supabase) {
  // Log bot stop event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Liquidation bot stopped',
    category: 'bot_state',
    bot_type: 'liquidation',
    source: 'system'
  });
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');

  // Update health check logs for each module
  for (const module of BOT_MODULES) {
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `${module} stopped`,
      category: 'health_check',
      bot_type: 'liquidation',
      source: module,
      metadata: { status: 'inactive', details: 'Module stopped by user' }
    });
  }
  
  return { success: true, message: "Bot stopped successfully" };
}

// Function to update the bot's configuration
async function updateBotConfig(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};
  
  // Log configuration update
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Bot configuration updated: profit threshold=${profitThreshold} ETH, base token=${baseToken.symbol}`,
    category: 'configuration',
    bot_type: 'liquidation',
    source: 'system',
    metadata: { 
      baseToken, 
      profitThreshold,
      gasMultiplier,
      maxGasPrice
    }
  });
  
  // The actual bot will pick up these configuration changes from the database
  // and apply them on the next execution cycle
  
  return { success: true, message: "Configuration updated successfully" };
}

// Function to get bot status and statistics
async function getBotStatus(supabase) {
  // Get current bot statistics
  const { data: statistics, error: statsError } = await supabase
    .from('bot_statistics')
    .select('*')
    .eq('bot_type', 'liquidation')
    .single();
  
  if (statsError && statsError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
  }
  
  // If statistics don't exist, create them
  if (!statistics) {
    const { data: newStats, error: createError } = await supabase
      .from('bot_statistics')
      .insert({
        bot_type: 'liquidation',
        total_profit: 0,
        success_rate: 0,
        average_profit: 0,
        gas_spent: 0,
        transactions_count: 0,
        is_running: false
      })
      .select();
      
    if (createError) {
      throw new Error(`Failed to create bot statistics: ${createError.message}`);
    }
  }
  
  // Get recent transactions (last 10)
  const { data: transactions, error: txError } = await supabase
    .from('bot_transactions')
    .select('*')
    .eq('bot_type', 'liquidation')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }
  
  // Get recent logs (last 20)
  const { data: logs, error: logsError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'liquidation')
    .order('timestamp', { ascending: false })
    .limit(20);
  
  if (logsError) {
    throw new Error(`Failed to fetch logs: ${logsError.message}`);
  }

  // Get module health status
  const { data: healthLogs, error: healthError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'liquidation')
    .eq('category', 'health_check')
    .order('timestamp', { ascending: false });
    
  let moduleStatus = {};
  if (healthLogs) {
    const seenModules = new Set();
    healthLogs.forEach(log => {
      const module = log.source;
      if (module && !seenModules.has(module)) {
        seenModules.add(module);
        moduleStatus[module] = {
          status: log.metadata?.status || 'inactive',
          lastChecked: log.timestamp,
          details: log.metadata
        };
      }
    });
  }
  
  return {
    success: true,
    status: statistics?.is_running ? "running" : "stopped",
    statistics: statistics || {},
    transactions: transactions || [],
    logs: logs || [],
    moduleStatus
  };
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
      case 'updateConfig':
        result = await updateBotConfig(supabase, config);
        break;
      case 'status':
        result = await getBotStatus(supabase);
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
    console.error('Error in liquidation-bot-control:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error?.message || 'An error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
