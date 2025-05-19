
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Type definitions
interface BotStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastChecked: number;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  metrics: {
    cyclesRun: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalProfit: string;
  };
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  version: string;
  botStatus: BotStatus;
  systemStatus: {
    cpuLoad: number[];
    memoryFree: number;
    memoryTotal: number;
  };
}

// Bot monitoring state
let botState: BotStatus = {
  name: process.env.BOT_TYPE || 'unknown',
  status: 'running',
  lastChecked: Date.now(),
  uptime: process.uptime(),
  memoryUsage: process.memoryUsage(),
  metrics: {
    cyclesRun: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalProfit: '0',
  },
};

// Initialize Supabase client if environment variables are available
let supabase: any = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

/**
 * Update bot metrics with latest data
 */
export function updateBotMetrics(metrics: Partial<BotStatus['metrics']>): void {
  botState.lastChecked = Date.now();
  botState.uptime = process.uptime();
  botState.memoryUsage = process.memoryUsage();
  botState.metrics = { ...botState.metrics, ...metrics };
}

/**
 * Update bot status
 */
export function updateBotStatus(status: BotStatus['status']): void {
  botState.status = status;
  botState.lastChecked = Date.now();
  
  // Log status change to Supabase if available
  if (supabase && process.env.BOT_TYPE) {
    supabase.from('bot_logs').insert({
      level: status === 'error' ? 'error' : 'info',
      message: `Bot status changed to ${status}`,
      category: 'bot_state',
      bot_type: process.env.BOT_TYPE,
      source: 'health_monitor'
    }).catch(console.error);
  }
}

/**
 * Get system information
 */
async function getSystemInfo() {
  return {
    cpuLoad: getCpuLoad(),
    memoryFree: getMemoryFree(),
    memoryTotal: getMemoryTotal(),
  };
}

// Simple system metrics functions
function getCpuLoad(): number[] {
  try {
    const os = require('os');
    return os.loadavg();
  } catch (error) {
    return [0, 0, 0];
  }
}

function getMemoryFree(): number {
  try {
    const os = require('os');
    return os.freemem();
  } catch (error) {
    return 0;
  }
}

function getMemoryTotal(): number {
  try {
    const os = require('os');
    return os.totalmem();
  } catch (error) {
    return 0;
  }
}

/**
 * Create and start a health check server
 */
export function startHealthServer(port: number = 3001): void {
  const server = http.createServer(async (req, res) => {
    // Only handle GET requests to /health
    if (req.method === 'GET' && req.url === '/health') {
      const systemStatus = await getSystemInfo();
      
      // Determine overall health status
      let healthStatus: HealthResponse['status'] = 'healthy';
      
      // If bot is in error state or memory usage is very high, mark as unhealthy
      if (botState.status === 'error') {
        healthStatus = 'unhealthy';
      } else if (botState.memoryUsage.heapUsed / botState.memoryUsage.heapTotal > 0.9) {
        healthStatus = 'degraded';
      }
      
      const healthData: HealthResponse = {
        status: healthStatus,
        timestamp: Date.now(),
        version: process.env.npm_package_version || '1.0.0',
        botStatus: botState,
        systemStatus,
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(healthData, null, 2));
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });
  
  server.listen(port, () => {
    console.log(`🏥 Health check server running on port ${port}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('Health check server error:', error);
  });
  
  // Create logs directory if it doesn't exist
  try {
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs');
    }
  } catch (error) {
    console.error('Error creating logs directory:', error);
  }
}

/**
 * Register process signal handlers for graceful shutdown
 */
export function registerShutdownHandlers(cleanupFunction?: () => Promise<void>): void {
  let isShuttingDown = false;
  
  // Handle termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log(`Received ${signal}. Starting graceful shutdown...`);
      updateBotStatus('stopped');
      
      try {
        // Execute cleanup function if provided
        if (cleanupFunction) {
          console.log('Running cleanup tasks...');
          await cleanupFunction();
        }
        
        // Log shutdown to Supabase if available
        if (supabase && process.env.BOT_TYPE) {
          await supabase.from('bot_logs').insert({
            level: 'info',
            message: `Bot shutting down gracefully, triggered by ${signal}`,
            category: 'bot_state',
            bot_type: process.env.BOT_TYPE,
            source: 'health_monitor'
          });
        }
        
        console.log('Graceful shutdown completed. Exiting...');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  });
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    updateBotStatus('error');
    
    // Log error to Supabase if available
    if (supabase && process.env.BOT_TYPE) {
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Uncaught exception: ${error.message}`,
        category: 'exception',
        bot_type: process.env.BOT_TYPE,
        source: 'health_monitor',
        metadata: { 
          error: error.message,
          stack: error.stack
        }
      });
    }
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    updateBotStatus('error');
    
    // Log error to Supabase if available
    if (supabase && process.env.BOT_TYPE) {
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Unhandled rejection: ${reason}`,
        category: 'exception',
        bot_type: process.env.BOT_TYPE,
        source: 'health_monitor',
        metadata: { reason }
      });
    }
  });
}
