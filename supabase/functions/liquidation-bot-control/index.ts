
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
    bot_type: 'liquidation',
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

// Function to start the liquidation bot
async function startBot(supabase, config) {
  const { protocol, healthFactorThreshold } = config;

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Liquidation bot started targeting ${protocol || 'all'} protocols with health factor threshold ${healthFactorThreshold || 'default'}`,
    'bot_state',
    'liquidation',
    'system',
    { protocol, healthFactorThreshold }
  );
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');
  
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
  
  return { 
    success: true, 
    message: "Bot started successfully",
    moduleStatus: Object.fromEntries(modules.map(m => [m, {
      status: 'ok',
      lastChecked: new Date().toISOString()
    }]))
  };
}

// Function to stop the liquidation bot
async function stopBot(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Liquidation bot stopped',
    'bot_state',
    'liquidation',
    'system'
  );
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');
  
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
  const { protocol, healthFactorThreshold, gasMultiplier, maxGasPrice } = config;
  
  // Log configuration update
  await logEvent(
    supabase,
    'info',
    `Bot configuration updated: targeting ${protocol || 'all'} protocols, health factor threshold=${healthFactorThreshold || 'default'}`,
    'configuration',
    'liquidation',
    'system',
    { 
      protocol, 
      healthFactorThreshold,
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
    .eq('bot_type', 'liquidation')
    .single();
  
  if (statsError) {
    throw new Error(`Failed to fetch bot statistics: ${statsError.message}`);
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
  
  // Get monitored users close to liquidation
  const { data: monitoredUsers, error: usersError } = await supabase
    .from('monitored_users')
    .select('*')
    .eq('is_active', true)
    .order('health_factor', { ascending: true })
    .limit(20);
  
  if (usersError) {
    throw new Error(`Failed to fetch monitored users: ${usersError.message}`);
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
  
  return {
    success: true,
    status: statistics?.is_running ? "running" : "stopped",
    statistics,
    transactions,
    monitoredUsers,
    logs,
    moduleStatus
  };
}

// Function to check PM2 status
async function checkPM2Status(supabase) {
  // Log the PM2 status check
  await logEvent(
    supabase,
    'info',
    'PM2 status check requested',
    'pm2_operation',
    'liquidation',
    'api',
    { action: 'status_check' }
  );
  
  // In a real environment, this would communicate with a server-side service 
  // that can execute PM2 commands. Here we just return a simulated response.
  
  // Retrieve bot status to determine if it's running
  const { data, error } = await supabase
    .from('bot_statistics')
    .select('is_running')
    .eq('bot_type', 'liquidation')
    .single();
  
  if (error) {
    throw new Error(`Failed to check bot status: ${error.message}`);
  }
  
  // Simulate PM2 status based on the bot's is_running flag
  const status = data?.is_running ? 'online' : 'stopped';
  
  return { success: true, status };
}

// Function to start bot with PM2
async function startPM2(supabase, config) {
  // Log PM2 start operation
  await logEvent(
    supabase,
    'info',
    'PM2 start operation requested',
    'pm2_operation',
    'liquidation',
    'api',
    { action: 'pm2_start', config }
  );
  
  // Update bot status to running
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');
  
  // In a real environment, this would communicate with a server-side service
  // to start the bot using PM2. Here we just return success.
  return { success: true, message: 'Bot started via PM2', status: 'online' };
}

// Function to stop bot with PM2
async function stopPM2(supabase) {
  // Log PM2 stop operation
  await logEvent(
    supabase,
    'info',
    'PM2 stop operation requested',
    'pm2_operation',
    'liquidation',
    'api',
    { action: 'pm2_stop' }
  );
  
  // Update bot status to stopped
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');
  
  // In a real environment, this would communicate with a server-side service
  // to stop the bot using PM2. Here we just return success.
  return { success: true, message: 'Bot stopped via PM2', status: 'stopped' };
}

// Function to restart bot with PM2
async function restartPM2(supabase) {
  // Log PM2 restart operation
  await logEvent(
    supabase,
    'info',
    'PM2 restart operation requested',
    'pm2_operation',
    'liquidation',
    'api',
    { action: 'pm2_restart' }
  );
  
  // Update bot status to running (since restart will result in running state)
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'liquidation');
  
  // In a real environment, this would communicate with a server-side service
  // to restart the bot using PM2. Here we just return success.
  return { success: true, message: 'Bot restarted via PM2', status: 'online' };
}

// Function to view PM2 logs
async function viewPM2Logs(supabase) {
  // Log PM2 logs request
  await logEvent(
    supabase,
    'info',
    'PM2 logs requested',
    'pm2_operation',
    'liquidation',
    'api',
    { action: 'view_logs' }
  );
  
  // In a real environment, this would retrieve logs from PM2.
  // Here we just return the most recent bot logs from the database.
  const { data, error } = await supabase
    .from('bot_logs')
    .select('*')
    .eq('bot_type', 'liquidation')
    .order('timestamp', { ascending: false })
    .limit(50);
  
  if (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }
  
  return { 
    success: true, 
    message: 'Retrieved PM2 logs', 
    logs: data || []
  };
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
        result = await checkPM2Status(supabase);
        break;
      case 'pm2Start':
        result = await startPM2(supabase, config);
        break;
      case 'pm2Stop':
        result = await stopPM2(supabase);
        break;
      case 'pm2Restart':
        result = await restartPM2(supabase);
        break;
      case 'pm2Logs':
        result = await viewPM2Logs(supabase);
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
    console.error('Error in liquidation-bot-control:', error);
    
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
