
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
    bot_type: 'arbitrage',
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

// Mock function for PM2 operations - will be replaced with real implementation in production
async function mockPm2Operation(operation, params = {}) {
  // This is a mock implementation for edge function environment
  // In production, this would use proper PM2 API calls
  
  console.log(`PM2 ${operation} operation requested with params:`, params);
  
  // Simulate success response for different operations
  switch (operation) {
    case 'start':
      return { success: true, output: `Started process ${params.name || 'arbitrage-bot'}` };
    case 'stop':
      return { success: true, output: `Stopped process ${params.name || 'arbitrage-bot'}` };
    case 'restart':
      return { success: true, output: `Restarted process ${params.name || 'arbitrage-bot'}` };
    case 'logs':
      return { success: true, output: 'mock logs output for arbitrage-bot' };
    case 'status':
      return { success: true, status: 'online', output: 'arbitrage-bot online' };
    default:
      return { success: false, error: `Unknown operation: ${operation}` };
  }
}

// Function to start the bot with PM2
async function startBotWithPm2(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Starting Arbitrage bot with PM2... profit threshold: ${profitThreshold} ETH`,
    'bot_state',
    'arbitrage',
    'system',
    { baseToken, profitThreshold, gasMultiplier, maxGasPrice, pm2: true }
  );
  
  // Execute PM2 start command (mock for edge function environment)
  const pm2Result = await mockPm2Operation('start', {
    name: 'arbitrage-bot',
    config: {
      profitThreshold: profitThreshold || 0.1,
      baseToken: baseToken?.symbol || 'USDC',
      gasMultiplier: gasMultiplier || 1.2,
      maxGasPrice: maxGasPrice || 30
    }
  });
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to start Arbitrage bot: ${pm2Result.error}`,
      'bot_state',
      'arbitrage',
      'system'
    );
    throw new Error(`Failed to start bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to running
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');

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
    'Stopping Arbitrage bot with PM2...',
    'bot_state',
    'arbitrage',
    'system'
  );
  
  // Execute PM2 stop command (mock for edge function environment)
  const pm2Result = await mockPm2Operation('stop', { name: 'arbitrage-bot' });
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to stop Arbitrage bot: ${pm2Result.error}`,
      'bot_state',
      'arbitrage',
      'system'
    );
    throw new Error(`Failed to stop bot with PM2: ${pm2Result.error}`);
  }
  
  // Update bot status in database to stopped
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');

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
    'Restarting Arbitrage bot with PM2...',
    'bot_state',
    'arbitrage',
    'system'
  );
  
  // Execute PM2 restart command (mock for edge function environment)
  const pm2Result = await mockPm2Operation('restart', { name: 'arbitrage-bot' });
  
  if (!pm2Result.success) {
    await logEvent(
      supabase,
      'error',
      `PM2 failed to restart Arbitrage bot: ${pm2Result.error}`,
      'bot_state',
      'arbitrage',
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
    'Requesting PM2 logs for Arbitrage bot',
    'monitoring',
    'arbitrage',
    'system'
  );
  
  // Execute PM2 logs command (mock for edge function environment)
  const pm2Result = await mockPm2Operation('logs', { name: 'arbitrage-bot', lines: 50 });
  
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
  // Execute PM2 status command (mock for edge function environment)
  const pm2Result = await mockPm2Operation('status', { name: 'arbitrage-bot' });
  
  if (!pm2Result.success) {
    throw new Error(`Failed to get PM2 status: ${pm2Result.error}`);
  }
  
  // Get status from the result
  const botStatus = pm2Result.status || 'unknown';
  
  // Log the status check
  await logEvent(
    supabase,
    'info',
    `PM2 status check: ${botStatus}`,
    'monitoring',
    'arbitrage',
    'system',
    { pm2Status: botStatus }
  );
  
  return { 
    success: true, 
    status: botStatus,
    fullOutput: pm2Result.output
  };
}

// Function to start the arbitrage bot
async function startBot(supabase, config) {
  const { baseToken, profitThreshold, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Arbitrage bot started with ${baseToken.symbol} as base token and ${profitThreshold} ETH profit threshold`,
    'bot_state',
    'arbitrage',
    'system',
    { baseToken, profitThreshold, gasMultiplier, maxGasPrice }
  );
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');

  // Create initial health check logs for each module
  const modules = ['scanner', 'builder', 'executor', 'watcher'];
  for (const module of modules) {
    await reportModuleStatus(
      supabase, 
      module, 
      'ok', 
      { details: 'Module initialized by API' }
    );
  }
  
  return { 
    success: true, 
    message: "Bot started successfully",
    moduleStatus: Object.fromEntries(modules.map(m => [m, {
      status: 'ok',
      lastChecked: new Date().toISOString()
    }]))
  };
}

// Function to stop the arbitrage bot
async function stopBot(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Arbitrage bot stopped',
    'bot_state',
    'arbitrage',
    'system'
  );
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'arbitrage');

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
    'arbitrage',
    'source',
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

// Function to get bot status and statistics
async function getBotStatus(supabase) {
  try {
    // Get current bot statistics
    const { data: statistics, error: statsError } = await supabase
      .from('bot_statistics')
      .select('*')
      .eq('bot_type', 'arbitrage')
      .single();
    
    if (statsError) {
      throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
    }
    
    // Get recent transactions (last 10)
    const { data: transactions, error: txError } = await supabase
      .from('bot_transactions')
      .select('*')
      .eq('bot_type', 'arbitrage')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }
    
    // Get recent logs (last 20)
    const { data: logs, error: logsError } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_type', 'arbitrage')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (logsError) {
      throw new Error(`Failed to fetch logs: ${logsError.message}`);
    }

    // Get module health status
    const { data: healthLogs, error: healthError } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_type', 'arbitrage')
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
          lastChecked: undefined,
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
  } catch (error) {
    console.error("Error in getBotStatus:", error);
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
        message: error?.message || 'An error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
