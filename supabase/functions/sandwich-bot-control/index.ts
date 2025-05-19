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
    bot_type: 'sandwich',
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

// Mock function for PM2 operations
async function mockPm2Operation(operation, params = {}) {
  console.log(`PM2 ${operation} operation requested with params:`, params);
  
  // Simulate success response for different operations
  switch (operation) {
    case 'start':
      return { success: true, output: `Started process ${params.name || 'sandwich-bot'}` };
    case 'stop':
      return { success: true, output: `Stopped process ${params.name || 'sandwich-bot'}` };
    case 'restart':
      return { success: true, output: `Restarted process ${params.name || 'sandwich-bot'}` };
    case 'logs':
      return { success: true, output: 'mock logs output for sandwich-bot' };
    case 'status':
      return { success: true, status: 'online', output: 'sandwich-bot online' };
    default:
      return { success: false, error: `Unknown operation: ${operation}` };
  }
}

// Function to get PM2 status
async function getPm2Status(supabase) {
  try {
    // Execute PM2 status command
    const pm2Result = await mockPm2Operation('status', { name: 'sandwich-bot' });
    
    if (!pm2Result.success) {
      throw new Error(`Failed to get PM2 status: ${pm2Result.error}`);
    }
    
    // Get status from the result
    const botStatus = pm2Result.status || 'unknown';
    
    // Log the status check
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `PM2 status check: ${botStatus}`,
      category: 'monitoring',
      bot_type: 'sandwich',
      source: 'system',
      metadata: { pm2Status: botStatus }
    });
    
    return { 
      success: true, 
      status: botStatus,
      fullOutput: pm2Result.output
    };
  } catch (error) {
    console.error('Error getting PM2 status:', error);
    throw error;
  }
}

// Function to start the bot with PM2
async function startBotWithPm2(supabase, config) {
  try {
    const { targetPools, minProfit, gasMultiplier } = config || {};
    
    // Log bot start event
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: `Starting Sandwich bot with PM2`,
      category: 'bot_state',
      bot_type: 'sandwich',
      source: 'system',
      metadata: { targetPools, minProfit, gasMultiplier, pm2: true }
    });
    
    // Execute PM2 start command
    const pm2Result = await mockPm2Operation('start', {
      name: 'sandwich-bot',
      config
    });
    
    if (!pm2Result.success) {
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `PM2 failed to start Sandwich bot: ${pm2Result.error}`,
        category: 'bot_state',
        bot_type: 'sandwich',
        source: 'system'
      });
      throw new Error(`Failed to start bot with PM2: ${pm2Result.error}`);
    }
    
    // Update bot status in database
    await supabase.from('bot_statistics').update({ 
      is_running: true,
      updated_at: new Date().toISOString() 
    }).eq('bot_type', 'sandwich');
    
    return { 
      success: true, 
      message: "Bot started successfully with PM2",
      pm2Output: pm2Result.output
    };
  } catch (error) {
    console.error('Error starting bot with PM2:', error);
    throw error;
  }
}

// Function to stop the bot with PM2
async function stopBotWithPm2(supabase) {
  try {
    // Log bot stop event
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: 'Stopping Sandwich bot with PM2',
      category: 'bot_state',
      bot_type: 'sandwich',
      source: 'system'
    });
    
    // Execute PM2 stop command
    const pm2Result = await mockPm2Operation('stop', { name: 'sandwich-bot' });
    
    if (!pm2Result.success) {
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `PM2 failed to stop Sandwich bot: ${pm2Result.error}`,
        category: 'bot_state',
        bot_type: 'sandwich',
        source: 'system'
      });
      throw new Error(`Failed to stop bot with PM2: ${pm2Result.error}`);
    }
    
    // Update bot status in database
    await supabase.from('bot_statistics').update({ 
      is_running: false,
      updated_at: new Date().toISOString() 
    }).eq('bot_type', 'sandwich');
    
    return { 
      success: true, 
      message: "Bot stopped successfully with PM2",
      pm2Output: pm2Result.output
    };
  } catch (error) {
    console.error('Error stopping bot with PM2:', error);
    throw error;
  }
}

// Function to restart the bot with PM2
async function restartBotWithPm2(supabase) {
  try {
    // Log bot restart event
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: 'Restarting Sandwich bot with PM2',
      category: 'bot_state',
      bot_type: 'sandwich',
      source: 'system'
    });
    
    // Execute PM2 restart command
    const pm2Result = await mockPm2Operation('restart', { name: 'sandwich-bot' });
    
    if (!pm2Result.success) {
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `PM2 failed to restart Sandwich bot: ${pm2Result.error}`,
        category: 'bot_state',
        bot_type: 'sandwich',
        source: 'system'
      });
      throw new Error(`Failed to restart bot with PM2: ${pm2Result.error}`);
    }
    
    return { 
      success: true, 
      message: "Bot restarted successfully with PM2",
      pm2Output: pm2Result.output
    };
  } catch (error) {
    console.error('Error restarting bot with PM2:', error);
    throw error;
  }
}

// Function to get PM2 logs
async function getPm2Logs(supabase) {
  try {
    // Log request for logs
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: 'Requesting PM2 logs for Sandwich bot',
      category: 'monitoring',
      bot_type: 'sandwich',
      source: 'system'
    });
    
    // Execute PM2 logs command
    const pm2Result = await mockPm2Operation('logs', { name: 'sandwich-bot', lines: 50 });
    
    if (!pm2Result.success) {
      throw new Error(`Failed to get PM2 logs: ${pm2Result.error}`);
    }
    
    return { 
      success: true, 
      logs: pm2Result.output
    };
  } catch (error) {
    console.error('Error getting PM2 logs:', error);
    throw error;
  }
}

// Function to start the sandwich bot
async function startBot(supabase, config) {
  const { targetPools, minProfit, gasMultiplier } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Sandwich bot started targeting pools: ${targetPools}, minProfit: ${minProfit}`,
    'bot_state',
    'sandwich',
    'system',
    { targetPools, minProfit, gasMultiplier }
  );
  
  // Update bot status in database to trigger the bot to start
  await supabase.from('bot_statistics').update({ 
    is_running: true,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'sandwich');

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
  
  return { success: true, message: "Bot started successfully" };
}

// Function to stop the sandwich bot
async function stopBot(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Sandwich bot stopped',
    'bot_state',
    'sandwich',
    'system'
  );
  
  // Update bot status in database to trigger the bot to stop
  await supabase.from('bot_statistics').update({ 
    is_running: false,
    updated_at: new Date().toISOString() 
  }).eq('bot_type', 'sandwich');

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
  const { targetPools, minProfit, gasMultiplier } = config || {};
  
  // Log configuration update
  await logEvent(
    supabase,
    'info',
    `Bot configuration updated: targetPools=${targetPools}, minProfit=${minProfit}`,
    'configuration',
    'sandwich',
    'system',
    { 
      targetPools, 
      minProfit,
      gasMultiplier
    }
  );
  
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
    console.error('Error in sandwich-bot-control:', error);
    
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
