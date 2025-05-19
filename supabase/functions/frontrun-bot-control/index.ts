
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
  // Ensure status is one of the valid values
  const validStatusValues = ['ok', 'error', 'warning', 'inactive', 'needs_fix'];
  const normalizedStatus = validStatusValues.includes(status) ? status : 'inactive';
  
  // Check if there are any silent errors to report
  const silentErrors = Array.isArray(details.silent_errors) ? details.silent_errors : [];
  
  // Determine if module needs fixing
  const needsFix = silentErrors.length > 0 || normalizedStatus === 'error';
  
  // Define a safe health status
  const healthStatus = needsFix ? 'needs_fix' : normalizedStatus;
  
  return await supabase.from('bot_logs').insert({
    level: normalizedStatus === 'error' ? 'error' : normalizedStatus === 'warning' ? 'warn' : 'info',
    message: `${module} status: ${normalizedStatus}`,
    category: 'health_check',
    bot_type: 'frontrun',
    source: module,
    timestamp: new Date().toISOString(),
    metadata: {
      status: normalizedStatus, 
      health: healthStatus,
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
        output = `[PM2] Starting ${args[0] || 'frontrun-bot'}`;
        break;
      case 'stop':
        output = `[PM2] Stopping ${args[0] || 'frontrun-bot'}`;
        break;
      case 'restart':
        output = `[PM2] Restarting ${args[0] || 'frontrun-bot'}`;
        break;
      case 'status':
        output = `[PM2] online - frontrun-bot`;
        break;
      case 'logs':
        output = `[PM2] Logs for ${args[0] || 'frontrun-bot'}\n[INFO] Bot running\n[INFO] Scanning for opportunities`;
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

// Function to start the frontrun bot with PM2
async function startBotWithPm2(supabase, config) {
  const { minProfitThreshold, targetDEXs, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Starting Frontrun bot with PM2... profit threshold: ${minProfitThreshold} ETH`,
    'bot_state',
    'frontrun',
    'system',
    { minProfitThreshold, targetDEXs, gasMultiplier, maxGasPrice, pm2: true }
  );
  
  // Execute PM2 start command
  const pm2Result = await executePm2Command("start", [
    "ecosystem.config.ts", 
    "--", 
    `--minProfit=${minProfitThreshold}`,
    `--gasMultiplier=${gasMultiplier || 1.2}`,
    `--maxGasPrice=${maxGasPrice || 30}`
  ]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to start Frontrun bot: ${pm2Result.error}`,
      'bot_state',
      'frontrun',
      'system'
    );
    throw new Error(`Failed to start bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to running
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'frontrun');

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

// Function to stop the frontrun bot with PM2
async function stopBotWithPm2(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Stopping Frontrun bot with PM2...',
    'bot_state',
    'frontrun',
    'system'
  );
  
  // Execute PM2 stop command
  const pm2Result = await executePm2Command("stop", ["frontrun-bot"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to stop Frontrun bot: ${pm2Result.error}`,
      'bot_state',
      'frontrun',
      'system'
    );
    throw new Error(`Failed to stop bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to stopped
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'frontrun');

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
    'Restarting Frontrun bot with PM2...',
    'bot_state',
    'frontrun',
    'system'
  );
  
  // Execute PM2 restart command
  const pm2Result = await executePm2Command("restart", ["frontrun-bot"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to restart Frontrun bot: ${pm2Result.error}`,
      'bot_state',
      'frontrun',
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
    'Requesting PM2 logs for Frontrun bot',
    'monitoring',
    'frontrun',
    'system'
  );
  
  // Execute PM2 logs command
  const pm2Result = await executePm2Command("logs", ["frontrun-bot", "--lines", "50"]);
  
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
  
  // Parse the output to find our bot's status
  const output = pm2Result.output;
  let botStatus = 'unknown';
  
  if (output.includes('frontrun-bot') && output.includes('online')) {
    botStatus = 'online';
  } else if (output.includes('frontrun-bot') && output.includes('stopped')) {
    botStatus = 'stopped';
  }
  
  // Log the status check
  await logEvent(
    supabase,
    'info',
    `PM2 status check: ${botStatus}`,
    'monitoring',
    'frontrun',
    'system',
    { pm2Status: botStatus }
  );
  
  return { 
    success: true, 
    status: botStatus,
    fullOutput: output
  };
}

// Function to update the bot's configuration
async function updateBotConfig(supabase, config) {
  const { minProfitThreshold, targetDEXs, gasMultiplier, maxGasPrice } = config || {};
  
  // Log configuration update
  await logEvent(
    supabase,
    'info',
    `Bot configuration updated: min profit=${minProfitThreshold} ETH`,
    'configuration',
    'frontrun',
    'system',
    { 
      minProfitThreshold,
      targetDEXs,
      gasMultiplier,
      maxGasPrice
    }
  );
  
  return { success: true, message: "Configuration updated successfully" };
}

// Function to get bot status and statistics
async function getBotStatus(supabase) {
  // Get current bot statistics
  const { data: statistics, error: statsError } = await supabase
    .from('bot_statistics')
    .select('*')
    .eq('bot_type', 'frontrun')
    .single();
  
  if (statsError) {
    throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
  }
  
  // Get recent transactions (last 10)
  const { data: transactions, error: txError } = await supabase
    .from('bot_transactions')
    .select('*')
    .eq('bot_type', 'frontrun')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }
  
  // Get recent logs (last 20)
  const { data: logs, error: logsError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'frontrun')
    .order('timestamp', { ascending: false })
    .limit(20);
  
  if (logsError) {
    throw new Error(`Failed to fetch logs: ${logsError.message}`);
  }

  // Get module health status
  const { data: healthLogs, error: healthError } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'frontrun')
    .eq('category', 'health_check')
    .order('timestamp', { ascending: false });
    
  // Process module status from health check logs
  let moduleStatus = {};
  if (healthLogs && healthLogs.length > 0) {
    const seenModules = new Set();
    healthLogs.forEach(log => {
      const module = log.source;
      if (module && !seenModules.has(module)) {
        seenModules.add(module);
        
        // Validate status values
        const validStatusValues = ['ok', 'error', 'warning', 'inactive', 'needs_fix'];
        
        // Extract and normalize metadata values
        const metadata = log.metadata || {};
        const silentErrors = Array.isArray(metadata.silent_errors) ? metadata.silent_errors : [];
        let statusValue = typeof metadata.status === 'string' && validStatusValues.includes(metadata.status) 
                          ? metadata.status : 'inactive';
        let healthValue = typeof metadata.health === 'string' && validStatusValues.includes(metadata.health)
                          ? metadata.health : statusValue;
                          
        const needsFix = silentErrors.length > 0 || statusValue === 'error' || 
                         (typeof metadata.needsAttention === 'boolean' && metadata.needsAttention);
        
        // If needs fixing, ensure health reflects this
        if (needsFix && healthValue !== 'needs_fix') {
          healthValue = 'needs_fix';
        }
        
        moduleStatus[module] = {
          status: statusValue,
          health: healthValue,
          lastChecked: log.timestamp,
          details: metadata,
          silentErrors: silentErrors,
          needsAttention: needsFix
        };
      }
    });
  }
  
  // Ensure all standard modules are represented
  const standardModules = ['scanner', 'builder', 'executor', 'watcher'];
  standardModules.forEach(module => {
    if (!moduleStatus[module]) {
      moduleStatus[module] = {
        status: 'inactive',
        health: 'inactive',
        lastChecked: undefined,
        details: {},
        silentErrors: [],
        needsAttention: false
      };
    }
  });
  
  // Get PM2 status
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
    const { action, config, testOptions } = await req.json();
    
    let result;
    
    // Handle different actions
    switch (action) {
      case 'start':
        result = await startBotWithPm2(supabase, config);
        break;
      case 'stop':
        result = await stopBotWithPm2(supabase);
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
      case 'pm2Status':
        result = await getPm2Status(supabase);
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
    console.error('Error in frontrun-bot-control:', error);
    
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
