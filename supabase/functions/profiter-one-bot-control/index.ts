
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
    bot_type: 'profiter-one',
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
        output = `[PM2] Starting ${args[0] || 'profiter-one'}`;
        break;
      case 'stop':
        output = `[PM2] Stopping ${args[0] || 'profiter-one'}`;
        break;
      case 'restart':
        output = `[PM2] Restarting ${args[0] || 'profiter-one'}`;
        break;
      case 'status':
        output = `[PM2] online - profiter-one`;
        break;
      case 'logs':
        output = `[PM2] Logs for ${args[0] || 'profiter-one'}\n[INFO] Bot running\n[INFO] Scanning for opportunities`;
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
    `Starting Profiter One bot with PM2... profit threshold: ${profitThreshold} ETH`,
    'bot_state',
    'profiter-one',
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
      `PM2 failed to start Profiter One bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-one',
      'system'
    );
    throw new Error(`Failed to start bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to running
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-one');

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
    'Stopping Profiter One bot with PM2...',
    'bot_state',
    'profiter-one',
    'system'
  );
  
  // Execute PM2 stop command
  const pm2Result = await executePm2Command("stop", ["profiter-one"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to stop Profiter One bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-one',
      'system'
    );
    throw new Error(`Failed to stop bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to stopped
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'profiter-one');

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
    'Restarting Profiter One bot with PM2...',
    'bot_state',
    'profiter-one',
    'system'
  );
  
  // Execute PM2 restart command
  const pm2Result = await executePm2Command("restart", ["profiter-one"]);
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to restart Profiter One bot: ${pm2Result.error}`,
      'bot_state',
      'profiter-one',
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
    'Requesting PM2 logs for Profiter One bot',
    'monitoring',
    'profiter-one',
    'system'
  );
  
  // Execute PM2 logs command
  const pm2Result = await executePm2Command("logs", ["profiter-one", "--lines", "50"]);
  
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
  
  if (output.includes('profiter-one') && output.includes('online')) {
    botStatus = 'online';
  } else if (output.includes('profiter-one') && output.includes('stopped')) {
    botStatus = 'stopped';
  }
  
  // Log the status check
  await logEvent(
    supabase,
    'info',
    `PM2 status check: ${botStatus}`,
    'monitoring',
    'profiter-one',
    'system',
    { pm2Status: botStatus }
  );
  
  return { 
    success: true, 
    status: botStatus,
    fullOutput: output
  };
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
  
  // Initialize module statuses
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'ok', 
      { details: 'Module initialized by API' }
    );
  }
  
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
  
  return { 
    success: true, 
    message: "Bot started successfully",
    moduleStatus: Object.fromEntries(modules.map(m => [m, {
      status: 'ok',
      lastChecked: new Date().toISOString()
    }]))
  };
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
  
  // Update module statuses to inactive
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'inactive', 
      { details: 'Module stopped by user' }
    );
  }
  
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
    
    // Get module health status
    const { data: healthLogs, error: healthError } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_type', 'profiter-one')
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
          
          const silentErrors = log.metadata?.silent_errors || [];
          const needsFix = silentErrors.length > 0 || log.metadata?.status === 'error';
          
          moduleStatus[module] = {
            status: log.metadata?.status || 'inactive',
            health: needsFix ? 'needs_fix' : (log.metadata?.health || log.metadata?.status || 'inactive'),
            lastChecked: log.timestamp,
            details: log.metadata,
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
          lastChecked: new Date().toISOString(),
          details: {},
          silentErrors: [],
          needsAttention: false
        };
      }
    });
    
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
      console.error("Failed to check PM2 status:", error);
      
      // Log successful status check
      await logEvent(
        supabase,
        'debug',
        'Status check performed (PM2 status check failed)',
        'api',
        'profiter-one',
        'api',
        { 
          isRunning: statistics?.is_running || false,
          transactionsCount: transactions?.length || 0,
          logsCount: logs?.length || 0,
          pm2Error: error.message
        }
      );
      
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

// Test function to simulate module errors (for development/testing)
async function simulateIssue(supabase, options) {
  const { module, status, errorCount } = options;
  
  const silentErrors = [];
  if (errorCount && errorCount > 0) {
    for (let i = 0; i < errorCount; i++) {
      silentErrors.push({
        message: `Mock error ${i+1} in ${module}`,
        timestamp: new Date().toISOString(),
        code: `ERR-${100 + i}`
      });
    }
  }
  
  await reportModuleStatus(
    supabase, 
    module, 
    status, 
    { 
      details: `Test ${status} status with ${silentErrors.length} silent errors`,
      silent_errors: silentErrors
    }
  );
  
  return { 
    success: true, 
    message: `Simulated ${status} status for ${module} with ${silentErrors.length} silent errors` 
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
      case 'test':
        // This action is only for development/testing
        result = await simulateIssue(supabase, testOptions);
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
