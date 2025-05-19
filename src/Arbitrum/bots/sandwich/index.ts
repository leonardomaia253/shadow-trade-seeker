import dotenv from 'dotenv';
import * as os from 'os'; // Import os module for system information
import { enhancedLogger as baseLogger, createContextLogger } from '../../utils/enhancedLogger';
import './sandwichScanner';

// Load environment variables
dotenv.config();

// Create a context-aware logger for this bot
const log = createContextLogger({
  botType: 'sandwich',
  source: 'main'
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
});

// Monitor memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  log.debug('Memory usage stats', {
    category: 'system',
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  });
}, 300000); // Every 5 minutes
