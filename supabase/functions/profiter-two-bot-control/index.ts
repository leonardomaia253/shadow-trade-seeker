
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.1";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to start the profiter-two bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: `Profiter Two bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    category: 'bot_state',
    bot_type: 'profiter-two',
    source: 'system',
    metadata: { baseToken, profitThreshold, gasMultiplier, maxGasPrice }
  });
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-two');

  // Create initial health check logs for each module
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `${module} initializing`,
      category: 'health_check',
      bot_type: 'profiter-two',
      source: module,
      metadata: { status: 'active', details: 'Module starting up' }
    });
  }
  
  return { success: true, message: "Bot started successfully" };
}

// Function to stop the profiter-two bot
async function stopBot(supabase) {
  // Log bot stop event
  await supabase.from('bot_logs').insert({
    level: 'info',
    message: 'Profiter Two bot stopped',
    category: 'bot_state',
    bot_type: 'profiter-two',
    source: 'system'
  });
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-two');

  // Update health check logs for each module
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `${module} stopped`,
      category: 'health_check',
      bot_type: 'profiter-two',
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
    bot_type: 'profiter-two',
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
    .eq('bot_type', 'profiter-two')
    .single();
  
  if (statsError) {
    throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
  }
  
  // Get recent transactions (last 10)
  const { data: transactions, error: txError } = await supabase
    .from('bot_transactions')
    .select('*')
    .eq('bot_type', 'profiter-two')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }
  
  // Get recent logs (last 20)
  const { data: logs, error: logsError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'profiter-two')
    .order('timestamp', { ascending: false })
    .limit(20);
  
  if (logsError) {
    throw new Error(`Failed to fetch logs: ${logsError.message}`);
  }

  // Get module health status
  const { data: healthLogs, error: healthError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'profiter-two')
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
    statistics,
    transactions,
    logs,
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
    console.error('Error in profiter-two-bot-control:', error);
    
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
