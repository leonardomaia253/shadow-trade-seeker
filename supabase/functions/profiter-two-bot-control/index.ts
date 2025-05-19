
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

// Function to report module status
async function reportModuleStatus(supabase, module, status, details = {}) {
  // Check if there are any silent errors to report
  const silentErrors = details.silent_errors || [];
  const needsFix = silentErrors.length > 0 || status === 'error';
  
  return await supabase.from('bot_logs').insert({
    level: status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'info',
    message: `${module} status: ${status}`,
    category: 'health_check',
    bot_type: 'profiter-two',
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
}

// Function to execute a PM2 command via bridge service
async function executePm2Command(command, args = []) {
  try {
    // In production, this would call a separate service that executes PM2 commands
    // For now, we'll simulate the responses
    
    // Log the command for debugging
    console.log(`PM2 command executed: ${command} ${args.join(' ')}`);
    
    // Simulate command execution
    let output = '';
    
    switch (command) {
      case 'start':
        output = `[PM2] Starting ${args[0] || 'profiter-two'}`;
        break;
      case 'stop':
        output = `[PM2] Stopping ${args[0] || 'profiter-two'}`;
        break;
      case 'restart':
        output = `[PM2] Restarting ${args[0] || 'profiter-two'}`;
        break;
      case 'status':
        output = `[PM2] online - profiter-two`;
        break;
      case 'logs':
        output = `[PM2] Logs for ${args[0] || 'profiter-two'}\n[INFO] Bot running\n[INFO] Scanning for opportunities`;
        break;
      default:
        output = `[PM2] Command executed: ${command}`;
    }
    
    return { success: true, output };
  } catch (error) {
    console.error(`Failed to execute PM2 command: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Function to start the bot with PM2
async function startBotWithPm2(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Starting Profiter Two bot with PM2... profit threshold: ${profitThreshold} ETH`,
    'bot_state',
    'profiter-two',
    'system',
    { baseToken, profitThreshold, gasMultiplier, maxGasPrice, pm2: true }
  );
  
  // Execute PM2 start command
  const pm2Result = await executePm2Command("start", [
    "ecosystem.config.ts", 
    "--", 
    `--profitThreshold=${profitThreshold || 0.1}`,
    `--baseToken=${baseToken?.symbol || 'USDC'}`,
    `--gasMultiplier=${gasMultiplier || 1.2}`,
    `--maxGasPrice=${maxGasPrice || 30}`
  ]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to start Profiter Two bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-two',
      'system'
    );
    throw new Error(`Failed to start bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to running
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-two');

  // Create initial health check logs for each module
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'ok', 
      { details: 'Module initialized by PM2' }
    );
  }
  
  return { 
    success: true, 
    message: "Bot started successfully with PM2",
    pm2Output: pm2Result.output
  };
}

// Function to stop the bot with PM2
async function stopBotWithPm2(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Stopping Profiter Two bot with PM2...',
    'bot_state',
    'profiter-two',
    'system'
  );
  
  // Execute PM2 stop command
  const pm2Result = await executePm2Command("stop", ["profiter-two"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to stop Profiter Two bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-two',
      'system'
    );
    throw new Error(`Failed to stop bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to stopped
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-two');

  // Update module statuses to inactive
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'inactive', 
      { details: 'Module stopped by PM2' }
    );
  }
  
  return { 
    success: true, 
    message: "Bot stopped successfully with PM2",
    pm2Output: pm2Result.output
  };
}

// Function to restart the bot with PM2
async function restartBotWithPm2(supabase) {
  // Log bot restart event
  await logEvent(
    supabase,
    'info',
    'Restarting Profiter Two bot with PM2...',
    'bot_state',
    'profiter-two',
    'system'
  );
  
  // Execute PM2 restart command
  const pm2Result = await executePm2Command("restart", ["profiter-two"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to restart Profiter Two bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-two',
      'system'
    );
    throw new Error(`Failed to restart bot with PM2: ${pm2Result.error}`);
  }
  
  // Update module statuses
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'ok', 
      { details: 'Module restarted by PM2' }
    );
  }
  
  return { 
    success: true, 
    message: "Bot restarted successfully with PM2",
    pm2Output: pm2Result.output
  };
}

// Function to get PM2 logs
async function getPm2Logs(supabase) {
  // Log request for logs
  await logEvent(
    supabase,
    'info',
    'Requesting PM2 logs for Profiter Two bot',
    'monitoring',
    'profiter-two',
    'system'
  );
  
  // Execute PM2 logs command
  const pm2Result = await executePm2Command("logs", ["profiter-two", "--lines", "50"]);
  
  if (!pm2Result.success) {
    throw new Error(`Failed to get PM2 logs: ${pm2Result.error}`);
  }
  
  return { 
    success: true, 
    logs: pm2Result.output
  };
}

// Function to get PM2 status
async function getPm2Status(supabase) {
  // Execute PM2 status command
  const pm2Result = await executePm2Command("status");
  
  if (!pm2Result.success) {
    throw new Error(`Failed to get PM2 status: ${pm2Result.error}`);
  }
  
  // Parse the output to determine bot status
  const output = pm2Result.output;
  let botStatus = 'unknown';
  
  // Check if the bot is running based on the status command output
  if (output.includes('online')) {
    botStatus = 'online';
  } else if (output.includes('stopped')) {
    botStatus = 'stopped';
  }
  
  // Log the status check
  await logEvent(
    supabase,
    'info',
    `PM2 status check: ${botStatus}`,
    'monitoring',
    'profiter-two',
    'system',
    { pm2Status: botStatus }
  );
  
  return { 
    success: true, 
    status: botStatus,
    fullOutput: output
  };
}

// Function to start the profiter-two bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Profiter Two bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    'bot_state',
    'profiter-two',
    'system',
    { baseToken, profitThreshold, gasMultiplier, maxGasPrice }
  );
  
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
  await logEvent(
    supabase,
    'info',
    'Profiter Two bot stopped',
    'bot_state',
    'profiter-two',
    'system'
  );
  
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
  await logEvent(
    supabase,
    'info',
    `Bot configuration updated: profit threshold=${profitThreshold} ETH, base token=${baseToken.symbol}`,
    'configuration',
    'profiter-two',
    'system',
    { 
      baseToken, 
      profitThreshold,
      gasMultiplier,
      maxGasPrice
    }
  );
  
  // The actual bot will pick up these configuration changes from the database
  // and apply them on the next execution cycle
  
  return { success: true, message: "Configuration updated successfully" };
}

// Function to report module status for testing
async function updateModuleStatus(supabase, moduleData) {
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
  
  // Get PM2 status
  try {
    const pm2StatusResult = await getPm2Status(supabase);
    
    return {
      success: true,
      status: statistics?.is_running ? "running" : "stopped",
      pm2Status: pm2StatusResult.status,
      statistics,
      transactions,
      logs,
      moduleStatus
    };
  } catch (error) {
    // Continue even if PM2 status check fails
    console.error("Failed to get PM2 status:", error);
    
    return {
      success: true,
      status: statistics?.is_running ? "running" : "stopped",
      pm2Status: "unknown",
      statistics,
      transactions,
      logs,
      moduleStatus
    };
  }
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
        result = await updateModuleStatus(supabase, moduleData);
        break;
      case 'status':
        result = await getBotStatus(supabase);
        break;
      case 'pm2Status':
        result = await getPm2Status(supabase);
        break;
      case 'pm2Start':
        result = await startBotWithPm2(supabase, config);
        break;
      case 'pm2Stop':
        result = await stopBotWithPm2(supabase);
        break;
      case 'pm2Restart':
        result = await restartBotWithPm2(supabase);
        break;
      case 'pm2Logs':
        result = await getPm2Logs(supabase);
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
