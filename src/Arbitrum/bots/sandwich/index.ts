
import dotenv from 'dotenv';
import * as os from 'os'; // Import os module for system information
import { enhancedLogger as baseLogger, createContextLogger } from '../../utils/enhancedLogger';
import { createBotModuleLogger, checkDependencies, updateBotStatus } from '../../utils/botLogger';
import { createClient } from "@supabase/supabase-js";
import './sandwichScanner';

// Load environment variables
dotenv.config();

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = process.env.SUPABASE_URL ? createClient(supabaseUrl, supabaseKey) : null;

// Create a context-aware logger for this bot
const log = createContextLogger({
  botType: 'sandwich',
  source: 'main'
});

// Create module loggers
const scannerLogger = createBotModuleLogger({
  botType: 'sandwich',
  module: 'scanner',
  supabase: supabase
});

const builderLogger = createBotModuleLogger({
  botType: 'sandwich',
  module: 'builder',
  supabase: supabase
});

const executorLogger = createBotModuleLogger({
  botType: 'sandwich',
  module: 'executor',
  supabase: supabase
});

// Start message with more detailed information
log.info('Sandwich Bot started', {
  category: 'bot_state',
  params: {
    minProfitEth: process.env.MIN_PROFIT_ETH,
    minSlippageThreshold: process.env.MIN_SLIPPAGE_THRESHOLD,
    rpcUrl: process.env.WEBSOCKET_RPC_URL?.replace(/\/.*@/, '/***@'), // Mask sensitive parts
    gasMultiplier: process.env.GAS_MULTIPLIER || '1.2',
    maxGasPrice: process.env.MAX_GAS_PRICE || '30'
  }
});

// Log system information
try {
  const { version, platform, arch } = process;
  log.debug('System information', {
    category: 'system',
    nodeVersion: version,
    platform,
    architecture: arch,
    cpuCores: os.cpus().length, // Use os.cpus() instead of process.cpus()
    memory: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
  });
} catch (err) {
  log.debug('Could not log system information', { category: 'system' });
}

// Initialize all loggers for modules
scannerLogger.logInitialization({
  timestamp: new Date().toISOString(),
  minProfitEth: process.env.MIN_PROFIT_ETH,
  minSlippageThreshold: process.env.MIN_SLIPPAGE_THRESHOLD
});

builderLogger.logInitialization({
  timestamp: new Date().toISOString(),
});

executorLogger.logInitialization({
  timestamp: new Date().toISOString(),
});

// Check critical dependencies if we have Supabase configured
if (supabase) {
  // We'll use a dummy ethers provider for the dependency check
  const ethers = require('ethers');
  const provider = new ethers.providers.WebSocketProvider(process.env.WEBSOCKET_RPC_URL!);
  
  checkDependencies({
    botType: "sandwich",
    provider,
    supabase,
    dependencies: [
      {
        name: "mempool-connection",
        check: async () => {
          try {
            await provider.getBlockNumber();
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: "dex-contracts", 
        check: async () => {
          try {
            // Check a known DEX router
            const code = await provider.getCode("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"); // SushiSwap Router
            return code !== '0x';
          } catch {
            return false;
          }
        }
      }
    ]
  });
}

// The sandwichScanner.ts file is imported, which contains the main bot logic
// and will automatically start watching for opportunities when imported

// Keep the process running with enhanced error handling
process.on('uncaughtException', (error) => {
  log.critical(`Uncaught Exception`, {
    category: 'exception',
    errorName: error.name,
    stack: error.stack,
    message: error.message
  });
  
  // Log to database if available
  if (supabase) {
    // Fix: Use Promise chain properly instead of .catch()
    supabase.from('bot_logs').insert({
      level: 'critical',
      message: `Uncaught Exception: ${error.message}`,
      category: 'exception',
      bot_type: 'sandwich',
      source: 'system',
      metadata: { stack: error.stack }
    }).then(result => {
      if (result.error) {
        console.error('Failed to log to database:', result.error);
      }
    }).catch((err: Error) => {
      console.error('Error inserting log:', err);
    });
  }
  
  // Attempt graceful recovery
  setTimeout(() => {
    log.warn('Attempting recovery after uncaught exception', { category: 'recovery' });
    // Recovery logic could be implemented here
  }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  const reasonStr = reason instanceof Error ? reason.stack : String(reason);
  log.critical(`Unhandled Rejection`, {
    category: 'exception',
    reason: reasonStr,
    promise: String(promise)
  });
  
  // Log to database if available
  if (supabase) {
    // Fix: Use Promise chain properly instead of .catch()
    supabase.from('bot_logs').insert({
      level: 'critical',
      message: `Unhandled Rejection: ${reasonStr}`,
      category: 'exception',
      bot_type: 'sandwich',
      source: 'system',
      metadata: { reason: reasonStr }
    }).then(result => {
      if (result.error) {
        console.error('Failed to log to database:', result.error);
      }
    }).catch((err: Error) => {
      console.error('Error inserting log:', err);
    });
  }
});

// Monitor memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  const memStats = {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  };
  
  log.debug('Memory usage stats', {
    category: 'system',
    ...memStats
  });
  
  // Log to database if available
  if (supabase) {
    // Fix: Use Promise chain properly instead of .catch()
    supabase.from('bot_logs').insert({
      level: 'debug',
      message: 'Memory usage stats',
      category: 'system',
      bot_type: 'sandwich',
      source: 'system',
      metadata: memStats
    }).then(result => {
      if (result.error) {
        console.error('Failed to log to database:', result.error);
      }
    }).catch((err: Error) => {
      console.error('Error inserting log:', err);
    });
  }
}, 300000); // Every 5 minutes
