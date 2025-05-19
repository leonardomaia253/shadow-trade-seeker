
import { enhancedLogger, createContextLogger } from './enhancedLogger';
import { createClient } from '@supabase/supabase-js';

// Types for our structured logging system
export interface ModuleStatus {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'inactive';
  lastChecked: Date;
  details?: any;
}

export interface BotStatus {
  botType: string;
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  modules: ModuleStatus[];
  lastUpdated: Date;
}

// Client-side cache for bot status
const botStatusCache: Record<string, BotStatus> = {};

/**
 * Create a logger tailored for bot modules with standardized logging formats
 */
export function createBotModuleLogger(options: {
  botType: string;
  module: string;
  supabase?: any;
}) {
  const { botType, module, supabase } = options;
  
  // Create base logger with context
  const logger = createContextLogger({
    botType,
    module
  });
  
  // Initialize module status if not exists
  if (!botStatusCache[botType]) {
    botStatusCache[botType] = {
      botType,
      status: 'stopped',
      modules: [],
      lastUpdated: new Date()
    };
  }
  
  // Find or create module status entry
  let moduleStatus = botStatusCache[botType].modules.find(m => m.name === module);
  if (!moduleStatus) {
    moduleStatus = {
      name: module,
      status: 'inactive',
      lastChecked: new Date()
    };
    botStatusCache[botType].modules.push(moduleStatus);
  }
  
  // Enhanced logger with module-specific logic
  return {
    ...logger,
    
    // Log initialization of a module
    logInitialization: async (details?: any) => {
      moduleStatus!.status = 'ok';
      moduleStatus!.lastChecked = new Date();
      moduleStatus!.details = details;
      
      const logEntry = logger.info(`${module} initialized`, {
        category: 'initialization',
        module,
        details
      });
      
      if (supabase) {
        try {
          await supabase.from('bot_logs').insert({
            level: 'info',
            message: `${module} initialized`,
            category: 'initialization',
            bot_type: botType,
            source: module,
            metadata: { ...details }
          });
        } catch (error) {
          console.error('Failed to write initialization log to database:', error);
        }
      }
      
      return logEntry;
    },
    
    // Log module errors with standardized format
    logModuleError: async (error: any, context?: any) => {
      moduleStatus!.status = 'error';
      moduleStatus!.lastChecked = new Date();
      moduleStatus!.details = { error: error.message, context };
      
      const logEntry = logger.error(`Error in ${module}: ${error.message}`, {
        category: 'module_error',
        module,
        error: error.message,
        stack: error.stack,
        ...context
      });
      
      if (supabase) {
        try {
          await supabase.from('bot_logs').insert({
            level: 'error',
            message: `Error in ${module}: ${error.message}`,
            category: 'module_error',
            bot_type: botType,
            source: module,
            metadata: { 
              error: error.message, 
              stack: error.stack,
              ...context
            }
          });
        } catch (dbError) {
          console.error('Failed to write error log to database:', dbError);
        }
      }
      
      return logEntry;
    },
    
    // Log scan progress or activity
    logScan: async (message: string, details: any) => {
      moduleStatus!.lastChecked = new Date();
      
      const logEntry = logger.info(message, {
        category: 'scan',
        module,
        ...details
      });
      
      if (supabase) {
        await supabase.from('bot_logs').insert({
          level: 'info',
          message,
          category: 'scan',
          bot_type: botType,
          source: module,
          metadata: details
        }).catch(console.error);
      }
      
      return logEntry;
    },
    
    // Log build process activities
    logBuild: async (message: string, details: any) => {
      moduleStatus!.lastChecked = new Date();
      
      const logEntry = logger.info(message, {
        category: 'build',
        module,
        ...details
      });
      
      if (supabase) {
        await supabase.from('bot_logs').insert({
          level: 'info',
          message,
          category: 'build',
          bot_type: botType,
          source: module,
          metadata: details
        }).catch(console.error);
      }
      
      return logEntry;
    },
    
    // Log simulation activities
    logSimulation: async (message: string, details: any, success: boolean) => {
      moduleStatus!.lastChecked = new Date();
      
      const logEntry = success 
        ? logger.info(message, { category: 'simulation', module, ...details }) 
        : logger.warn(message, { category: 'simulation', module, ...details });
      
      if (supabase) {
        await supabase.from('bot_logs').insert({
          level: success ? 'info' : 'warn',
          message,
          category: 'simulation',
          bot_type: botType,
          source: module,
          metadata: details
        }).catch(console.error);
      }
      
      return logEntry;
    },
    
    // Log execution activities
    logExecution: async (message: string, details: any, success: boolean) => {
      moduleStatus!.lastChecked = new Date();
      
      const logEntry = success 
        ? logger.info(message, { category: 'execution', module, ...details }) 
        : logger.warn(message, { category: 'execution', module, ...details });
      
      if (supabase) {
        await supabase.from('bot_logs').insert({
          level: success ? 'info' : 'warn',
          message,
          category: 'execution',
          bot_type: botType,
          source: module,
          metadata: details
        }).catch(console.error);
      }
      
      return logEntry;
    },
    
    // Log module health check
    logHealthCheck: async (status: 'ok' | 'error' | 'warning', details?: any) => {
      moduleStatus!.status = status;
      moduleStatus!.lastChecked = new Date();
      moduleStatus!.details = details;
      
      const logEntry = logger.info(`${module} health check: ${status}`, {
        category: 'health_check',
        module,
        status,
        details
      });
      
      if (supabase) {
        await supabase.from('bot_logs').insert({
          level: status === 'ok' ? 'info' : status === 'warning' ? 'warn' : 'error',
          message: `${module} health check: ${status}`,
          category: 'health_check',
          bot_type: botType,
          source: module,
          metadata: details
        }).catch(console.error);
      }
      
      return logEntry;
    },
    
    // Get current module status
    getStatus: () => moduleStatus,
    
    // Update module status
    updateStatus: (status: 'ok' | 'error' | 'warning' | 'inactive', details?: any) => {
      moduleStatus!.status = status;
      moduleStatus!.lastChecked = new Date();
      if (details) moduleStatus!.details = details;
      return moduleStatus;
    }
  };
}

/**
 * Get the status of an entire bot and its modules
 */
export function getBotStatus(botType: string): BotStatus | null {
  return botStatusCache[botType] || null;
}

/**
 * Set the overall status of a bot
 */
export function updateBotStatus(
  botType: string, 
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error',
  supabase?: any
): void {
  // Create entry if doesn't exist
  if (!botStatusCache[botType]) {
    botStatusCache[botType] = {
      botType,
      status: 'stopped',
      modules: [],
      lastUpdated: new Date()
    };
  }
  
  // Update status
  botStatusCache[botType].status = status;
  botStatusCache[botType].lastUpdated = new Date();
  
  // Log to console
  enhancedLogger.botState(botType, status, { category: 'bot_state' });
  
  // Log to database if supabase is available
  if (supabase) {
    supabase.from('bot_logs').insert({
      level: 'info',
      message: `Bot ${botType} changed state to ${status}`,
      category: 'bot_state',
      bot_type: botType,
      source: 'system'
    }).catch(console.error);
    
    // Also update bot_statistics if available
    supabase.from('bot_statistics')
      .update({ 
        is_running: status === 'running',
        updated_at: new Date().toISOString() 
      })
      .eq('bot_type', botType)
      .catch(console.error);
  }
}

/**
 * Check initialization of dependencies and emit logs
 */
export async function checkDependencies(options: {
  botType: string;
  provider: any;
  supabase: any;
  dependencies: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}): Promise<boolean> {
  const { botType, provider, supabase, dependencies } = options;
  const log = createContextLogger({ botType, source: 'initialization' });
  
  log.info(`Checking dependencies for ${botType} bot`, { 
    category: 'initialization',
    dependencies: dependencies.map(d => d.name)
  });
  
  let allOk = true;
  
  // Check provider connection
  try {
    await provider.getNetwork();
    log.info('Provider connection successful', { category: 'initialization', component: 'provider' });
    
    await supabase.from('bot_logs').insert({
      level: 'info',
      message: 'Provider connection successful',
      category: 'initialization',
      bot_type: botType,
      source: 'system'
    });
  } catch (error: any) {
    allOk = false;
    log.critical('Provider connection failed', { 
      category: 'initialization', 
      component: 'provider',
      error: error.message
    });
    
    await supabase.from('bot_logs').insert({
      level: 'critical',
      message: `Provider connection failed: ${error.message}`,
      category: 'initialization',
      bot_type: botType,
      source: 'system',
      metadata: { error: error.message }
    });
  }
  
  // Check each dependency
  for (const dep of dependencies) {
    try {
      const isOk = await dep.check();
      if (isOk) {
        log.info(`Dependency ${dep.name} check: OK`, { 
          category: 'initialization', 
          component: dep.name 
        });
      } else {
        allOk = false;
        log.error(`Dependency ${dep.name} check: FAILED`, { 
          category: 'initialization', 
          component: dep.name 
        });
      }
      
      await supabase.from('bot_logs').insert({
        level: isOk ? 'info' : 'error',
        message: `Dependency ${dep.name} check: ${isOk ? 'OK' : 'FAILED'}`,
        category: 'initialization',
        bot_type: botType,
        source: 'system'
      });
    } catch (error: any) {
      allOk = false;
      log.error(`Dependency ${dep.name} check error: ${error.message}`, { 
        category: 'initialization', 
        component: dep.name,
        error: error.message
      });
      
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Dependency ${dep.name} check error: ${error.message}`,
        category: 'initialization',
        bot_type: botType,
        source: 'system',
        metadata: { error: error.message }
      });
    }
  }
  
  return allOk;
}
