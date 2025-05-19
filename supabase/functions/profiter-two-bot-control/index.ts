
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

  // Create initial health check logs for each module with enhanced status information
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `${module} initializing`,
      category: 'health_check',
      bot_type: 'profiter-two',
      source: module,
      metadata: { 
        status: 'active', 
        details: 'Module starting up',
        health: 'ok',
        last_error: null,
        last_checked: new Date().toISOString(),
        silent_errors_count: 0,
        performance_metrics: {
          response_time_ms: 0,
          success_rate: 100,
          error_rate: 0
        }
      }
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
      metadata: { 
        status: 'inactive', 
        details: 'Module stopped by user',
        health: 'inactive',
        last_checked: new Date().toISOString()
      }
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

// Function to report module status (new function)
async function reportModuleStatus(supabase, moduleData) {
  const { module, status, details, silent_errors } = moduleData || {};
  
  // Determine health status based on module status and silent errors
  const health = silent_errors && silent_errors.length > 0 ? 'needs_fix' : (status === 'active' ? 'ok' : status);
  
  // Insert the health check log with enhanced metadata
  await supabase.from('bot_logs').insert({
    level: silent_errors && silent_errors.length > 0 ? 'warn' : 'info',
    message: `${module} health check: ${health}`,
    category: 'health_check',
    bot_type: 'profiter-two',
    source: module,
    metadata: {
      status: status,
      health: health,
      details: details,
      last_checked: new Date().toISOString(),
      silent_errors: silent_errors || [],
      silent_errors_count: silent_errors ? silent_errors.length : 0,
      needs_attention: health === 'needs_fix'
    }
  });
  
  return { success: true, module, health };
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

  // Get module health status with enhanced details
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
      const module = log.source || 'unknown';
      
      // Only add if we haven't seen this module yet (since logs are ordered by timestamp desc)
      if (!seenModules.has(module)) {
        seenModules.add(module);
        
        // Extract health status from metadata or determine from log
        const health = log.metadata?.health || getHealthFromLog(log);
        
        moduleStatus[module] = {
          status: log.metadata?.status || 'inactive',
          health: health,
          lastChecked: log.timestamp,
          details: log.metadata,
          needsAttention: health === 'needs_fix',
          silentErrors: log.metadata?.silent_errors || []
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

// Helper function to determine health status from a log
function getHealthFromLog(log) {
  if (!log) return 'inactive';
  
  if (log.level === 'error' || log.level === 'critical') {
    return 'error';
  } else if (log.level === 'warn') {
    // Check for silent errors in metadata
    if (log.metadata?.silent_errors && log.metadata.silent_errors.length > 0) {
      return 'needs_fix';
    }
    return 'warning';
  } else if (log.level === 'info' || log.level === 'debug') {
    return 'ok';
  }
  
  return 'inactive';
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
    const { action, config, moduleData } = await req.json();
    
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
      case 'reportModuleStatus':
        result = await reportModuleStatus(supabase, moduleData);
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
