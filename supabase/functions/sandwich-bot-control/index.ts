
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.1";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to start the sandwich bot
async function startBot(supabase, config) {
  const { minProfitThreshold, minSlippageThreshold, targetDEXs } = config;

  // Log bot start event with more detailed information
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Sandwich bot started with ${minProfitThreshold} ETH profit threshold and ${minSlippageThreshold}% slippage threshold`,
    category: 'bot_state',
    bot_type: 'sandwich',
    source: 'system',
    metadata: { 
      minProfitThreshold, 
      minSlippageThreshold, 
      targetDEXs,
      action: 'start',
      initiatedBy: 'user',
      timestamp: new Date().toISOString(),
      environment: Deno.env.get('ENVIRONMENT') || 'production'
    }
  });
  
  // Log scanner module initialization
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot scanner module initialized',
    category: 'initialization',
    bot_type: 'sandwich',
    source: 'scanner',
    metadata: {
      status: 'active',
      config: { 
        minProfitThreshold,
        minSlippageThreshold
      }
    }
  });
  
  // Log builder module initialization
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot builder module initialized',
    category: 'initialization',
    bot_type: 'sandwich',
    source: 'builder',
    metadata: {
      status: 'active'
    }
  });
  
  // Log executor module initialization
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot executor module initialized',
    category: 'initialization',
    bot_type: 'sandwich',
    source: 'executor',
    metadata: {
      status: 'active'
    }
  });
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'sandwich');
  
  return { 
    success: true, 
    message: "Bot started successfully",
    details: {
      moduleStatus: {
        scanner: "active",
        builder: "active",
        executor: "active"
      },
      startTime: new Date().toISOString(),
      config: {
        minProfitThreshold,
        minSlippageThreshold,
        targetDEXs
      }
    }
  };
}

// Function to stop the sandwich bot
async function stopBot(supabase) {
  // Log bot stop event with detailed information
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot stopped',
    category: 'bot_state',
    bot_type: 'sandwich',
    source: 'system',
    metadata: {
      action: 'stop',
      initiatedBy: 'user',
      timestamp: new Date().toISOString(),
      reason: 'user_requested'
    }
  });
  
  // Log modules stopping
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot scanner module stopped',
    category: 'shutdown',
    bot_type: 'sandwich',
    source: 'scanner'
  });
  
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot builder module stopped',
    category: 'shutdown',
    bot_type: 'sandwich',
    source: 'builder'
  });
  
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot executor module stopped',
    category: 'shutdown',
    bot_type: 'sandwich',
    source: 'executor'
  });
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'sandwich');
  
  return { 
    success: true, 
    message: "Bot stopped successfully",
    details: {
      moduleStatus: {
        scanner: "inactive",
        builder: "inactive",
        executor: "inactive"
      },
      stopTime: new Date().toISOString()
    }
  };
}

// Function to update the bot's configuration
async function updateBotConfig(supabase, config) {
  const { minProfitThreshold, minSlippageThreshold, targetDEXs, gasMultiplier, maxGasPrice } = config;
  
  // Log configuration update with more detailed information
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Sandwich bot configuration updated: min profit=${minProfitThreshold} ETH, min slippage=${minSlippageThreshold}%`,
    category: 'configuration',
    bot_type: 'sandwich',
    source: 'system',
    metadata: { 
      minProfitThreshold, 
      minSlippageThreshold,
      targetDEXs,
      gasMultiplier,
      maxGasPrice,
      previousConfig: "Config values before update would be here",
      changedBy: "user",
      timestamp: new Date().toISOString()
    }
  });
  
  // Log scanner module reconfiguration
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Sandwich bot scanner module reconfigured',
    category: 'configuration',
    bot_type: 'sandwich',
    source: 'scanner',
    metadata: {
      newThresholds: {
        profit: minProfitThreshold,
        slippage: minSlippageThreshold
      }
    }
  });
  
  return { 
    success: true, 
    message: "Configuration updated successfully",
    details: {
      updatedConfig: {
        minProfitThreshold,
        minSlippageThreshold,
        targetDEXs,
        gasMultiplier,
        maxGasPrice
      },
      updateTime: new Date().toISOString()
    }
  };
}

// Function to get bot status and statistics
async function getBotStatus(supabase) {
  // Get current bot statistics
  const { data: statistics, error: statsError } = await supabase
    .from('bot_statistics')
    .select('*')
    .eq('bot_type', 'sandwich')
    .single();
  
  if (statsError) {
    throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
  }
  
  // Get recent transactions (last 10)
  const { data: transactions, error: txError } = await supabase
    .from('bot_transactions')
    .select('*')
    .eq('bot_type', 'sandwich')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }
  
  // Get recent logs (last 20)
  const { data: logs, error: logsError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'sandwich')
    .order('timestamp', { ascending: false })
    .limit(20);
  
  if (logsError) {
    throw new Error(`Failed to fetch logs: ${logsError.message}`);
  }
  
  // Get module health status
  const { data: healthLogs, error: healthError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'sandwich')
    .eq('category', 'health_check')
    .order('timestamp', { ascending: false })
    .limit(3);
  
  // Parse module health from logs or set default values
  const moduleHealth = {
    scanner: { status: statistics?.is_running ? "active" : "inactive", lastChecked: new Date().toISOString() },
    builder: { status: statistics?.is_running ? "active" : "inactive", lastChecked: new Date().toISOString() },
    executor: { status: statistics?.is_running ? "active" : "inactive", lastChecked: new Date().toISOString() }
  };
  
  if (healthLogs && healthLogs.length > 0) {
    healthLogs.forEach(log => {
      if (log.source && moduleHealth[log.source]) {
        moduleHealth[log.source] = {
          status: log.metadata?.status || moduleHealth[log.source].status,
          lastChecked: log.timestamp
        };
      }
    });
  }
  
  // Log this status query
  await supabase.from('bot_logs').insert({
    level: 'debug',
    message: 'Bot status requested',
    category: 'api',
    bot_type: 'sandwich',
    source: 'system',
    metadata: {
      isRunning: statistics?.is_running,
      timestamp: new Date().toISOString()
    }
  });
  
  return {
    success: true,
    status: statistics?.is_running ? "running" : "stopped",
    statistics,
    transactions,
    logs,
    modules: moduleHealth,
    lastChecked: new Date().toISOString()
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
    console.error('Error in sandwich-bot-control:', error);
    
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
