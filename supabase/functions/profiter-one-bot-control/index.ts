
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.1";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging function
function logEvent(supabase, level, message, category, botType, source, metadata = {}) {
  return supabase.from('bot_logs').insert({
    level,
    message,
    category,
    bot_type: botType,
    source,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      environment: Deno.env.get('ENVIRONMENT') || 'production',
      serverVersion: '1.0.0'
    }
  });
}

// Function to start the profiter-one bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier = 1.2, maxGasPrice = 30 } = config;

  // Log bot start event with detailed configuration
  await logEvent(
    supabase,
    'info',
    `Profiter-One bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    'bot_state',
    'profiter-one',
    'system',
    { 
      baseToken, 
      profitThreshold,
      gasMultiplier,
      maxGasPrice,
      startTime: new Date().toISOString(),
      initiatedBy: 'api',
      serverTimeUtc: new Date().toUTCString()
    }
  );
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString(),
    last_start_time: new Date().toISOString(),
    configuration: JSON.stringify({
      baseToken,
      profitThreshold,
      gasMultiplier,
      maxGasPrice
    })
  }).eq('bot_type', 'profiter-one');
  
  return { success: true, message: "Bot started successfully" };
}

// Function to stop the profiter-one bot
async function stopBot(supabase, reason = 'manual') {
  // Get runtime statistics
  const { data: stats } = await supabase
    .from('bot_statistics')
    .select('*')
    .eq('bot_type', 'profiter-one')
    .single();
    
  const runTime = stats?.last_start_time 
    ? (new Date().getTime() - new Date(stats.last_start_time).getTime()) / 1000 / 60 
    : 0;

  // Log bot stop event with runtime information
  await logEvent(
    supabase,
    'info',
    'Profiter-One bot stopped',
    'bot_state',
    'profiter-one',
    'system',
    {
      stopReason: reason,
      runTimeMinutes: Math.round(runTime * 100) / 100,
      stopTime: new Date().toISOString()
    }
  );
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString(),
    last_stop_time: new Date().toISOString(),
    last_runtime_minutes: runTime
  }).eq('bot_type', 'profiter-one');
  
  return { success: true, message: "Bot stopped successfully" };
}

// Function to update the bot's configuration
async function updateBotConfig(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config;
  
  // Get previous configuration for comparison
  const { data: previousConfig } = await supabase
    .from('bot_statistics')
    .select('configuration')
    .eq('bot_type', 'profiter-one')
    .single();
    
  let oldConfig = {};
  try {
    oldConfig = previousConfig?.configuration ? JSON.parse(previousConfig.configuration) : {};
  } catch (e) {
    console.error("Error parsing previous configuration:", e);
  }
  
  // Log configuration update with change details
  await logEvent(
    supabase,
    'info',
    `Bot configuration updated: profit threshold=${profitThreshold} ETH, base token=${baseToken.symbol}`,
    'configuration',
    'profiter-one',
    'system',
    { 
      baseToken, 
      profitThreshold,
      gasMultiplier,
      maxGasPrice,
      changes: {
        profitThresholdChanged: oldConfig.profitThreshold !== profitThreshold,
        baseTokenChanged: oldConfig.baseToken?.symbol !== baseToken.symbol,
        gasMultiplierChanged: oldConfig.gasMultiplier !== gasMultiplier,
        maxGasPriceChanged: oldConfig.maxGasPrice !== maxGasPrice
      },
      previousConfig: oldConfig
    }
  );
  
  // Update configuration in database
  await supabase.from('bot_statistics').update({ 
    configuration: JSON.stringify({
      baseToken,
      profitThreshold,
      gasMultiplier,
      maxGasPrice,
      lastUpdated: new Date().toISOString()
    }),
    updated_at: new Date().toISOString()
  }).eq('bot_type', 'profiter-one');
  
  return { success: true, message: "Configuration updated successfully" };
}

// Function to get bot status and statistics with enhanced error handling
async function getBotStatus(supabase) {
  try {
    // Get current bot statistics
    const { data: statistics, error: statsError } = await supabase
      .from('bot_statistics')
      .select('*')
      .eq('bot_type', 'profiter-one')
      .single();
    
    if (statsError) {
      await logEvent(
        supabase,
        'error',
        `Failed to fetch bot statistics: ${statsError.message}`,
        'database',
        'profiter-one',
        'api',
        { error: statsError }
      );
      throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
    }
    
    // Get recent transactions (last 10)
    const { data: transactions, error: txError } = await supabase
      .from('bot_transactions')
      .select('*')
      .eq('bot_type', 'profiter-one')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (txError) {
      await logEvent(
        supabase,
        'error',
        `Failed to fetch transactions: ${txError.message}`,
        'database',
        'profiter-one',
        'api',
        { error: txError }
      );
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }
    
    // Get recent logs (last 20)
    const { data: logs, error: logsError } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_type', 'profiter-one')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (logsError) {
      await logEvent(
        supabase,
        'error',
        `Failed to fetch logs: ${logsError.message}`,
        'database',
        'profiter-one',
        'api',
        { error: logsError }
      );
      throw new Error(`Failed to fetch logs: ${logsError.message}`);
    }
    
    // Log successful status check
    await logEvent(
      supabase,
      'debug',
      'Status check performed',
      'api',
      'profiter-one',
      'api',
      { 
        isRunning: statistics?.is_running || false,
        transactionsCount: transactions?.length || 0,
        logsCount: logs?.length || 0
      }
    );
    
    return {
      success: true,
      status: statistics?.is_running ? "running" : "stopped",
      statistics,
      transactions,
      logs
    };
  } catch (error) {
    // Log any unexpected errors during status check
    await logEvent(
      supabase,
      'error',
      `Error in getBotStatus: ${error.message}`,
      'exception',
      'profiter-one',
      'api',
      { 
        error: error.message,
        stack: error.stack
      }
    );
    throw error;
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
    
    // Log API request
    await logEvent(
      supabase,
      'info',
      `API request received: ${action}`,
      'api',
      'profiter-one',
      'api',
      { 
        action,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        clientIp: req.headers.get('x-forwarded-for') || 'unknown'
      }
    );
    
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
        const errorMessage = `Unknown action: ${action}`;
        await logEvent(
          supabase,
          'error',
          errorMessage,
          'api',
          'profiter-one',
          'api',
          { action }
        );
        throw new Error(errorMessage);
    }
    
    // Log successful response
    await logEvent(
      supabase,
      'info',
      `API request completed: ${action}`,
      'api',
      'profiter-one',
      'api',
      { 
        action,
        success: true,
        responseTime: new Date().toISOString()
      }
    );
    
    // Return success response
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    // Log error in API request
    console.error('Error in profiter-one-bot-control:', error);
    
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
