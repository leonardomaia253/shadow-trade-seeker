import dotenv from 'dotenv';
import { enhancedLogger as log } from '../../utils/enhancedLogger';
import './frontrunwatcher';

// Load environment variables
dotenv.config();

// Start message
log.info('🚀 Frontrun Bot started');
log.info(`📊 Min profit threshold: ${process.env.MIN_PROFIT_ETH} ETH`);
log.info(`🔄 Using ${process.env.WEBSOCKET_RPC_URL} for blockchain connection`);

// The frontrunwatcher.ts file is imported, which contains the main bot logic
// and will automatically start watching for opportunities when imported

// Keep the process running
process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception: ${error.message}`);
  log.error(error.stack || '');
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise);
  log.error('Reason:', reason);
});
