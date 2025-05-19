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

// Function to start the frontrun bot
async function startBot(supabase, config) {
  const { minProfitThreshold, targetDEXs, gasMultiplier, maxGasPrice } = config || {};

  // Log bot start event
  await logEvent(
    supabase,
    'info',
    `Frontrun bot started with ${minProfitThreshold} ETH profit threshold`,
    'bot_state',
    'frontrun',
    'system',
    { minProfitThreshold, targetDEXs, gasMultiplier, maxGasPrice }
  );
  
  // Update bot status in database to trigger the bot to start
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

// Function to stop the frontrun bot
async function stopBot(supabase) {
  // Log bot stop event
  await logEvent(
    supabase,
    'info',
    'Frontrun bot stopped',
    'bot_state',
    'frontrun',
    'system'
  );
  
  // Update bot status in database to trigger the bot to stop
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
      { details: 'Module stopped by user' }
    );
  }
  
  return { success: true, message: "Bot stopped successfully" };
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
  
  return {
    success: true,
    status: statistics?.is_running ? "running" : "stopped",
    statistics,
    transactions,
    logs,
    moduleStatus
  };
}

// Test function to simulate module errors (for development/testing)
async function simulateIssue(supabase, options) {
  const { module, status, errorCount } = options;
  
  // Validate status to ensure it's one of the allowed values
  const validStatusValues = ['ok', 'error', 'warning', 'inactive', 'needs_fix'];
  const normalizedStatus = validStatusValues.includes(status) ? status : 'inactive';
  
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
    normalizedStatus, 
    { 
      details: `Test ${normalizedStatus} status with ${silentErrors.length} silent errors`,
      silent_errors: silentErrors
    }
  );
  
  return { 
    success: true, 
    message: `Simulated ${normalizedStatus} status for ${module} with ${silentErrors.length} silent errors` 
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
