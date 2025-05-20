
const express = require('express');
const cors = require('cors');
const pm2 = require('pm2');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

// Promisify PM2 functions
const pm2Connect = promisify(pm2.connect.bind(pm2));
const pm2List = promisify(pm2.list.bind(pm2));
const pm2Start = promisify(pm2.start.bind(pm2));
const pm2Stop = promisify(pm2.stop.bind(pm2));
const pm2Restart = promisify(pm2.restart.bind(pm2));
const pm2Describe = promisify(pm2.describe.bind(pm2));
const pm2Disconnect = () => pm2.disconnect();

// Load environment variables
require('dotenv').config();

// API key for authentication
const API_KEY = process.env.PM2_API_KEY || 'your-api-key';

// Maximum number of log lines to return
const MAX_LOG_LINES = 500;

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  
  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Apply authentication to all routes
app.use(authenticate);

// Get logs for a specific process
async function getProcessLogs(processName, lines = 100) {
  const logLimit = Math.min(lines, MAX_LOG_LINES);
  
  try {
    // Try to find the PM2 log file for the process
    const processes = await pm2List();
    const process = processes.find(p => p.name === processName);
    
    if (!process || !process.pm2_env) {
      throw new Error(`Process ${processName} not found`);
    }
    
    const logPath = process.pm2_env.pm_out_log_path;
    const errorLogPath = process.pm2_env.pm_err_log_path;
    
    let logs = '';
    
    // Read output logs if available
    try {
      const outputLogs = await fs.readFile(logPath, 'utf8');
      const outputLogLines = outputLogs.split('\n').slice(-logLimit);
      logs += outputLogLines.join('\n');
    } catch (error) {
      console.warn(`Could not read output logs for ${processName}:`, error.message);
    }
    
    // Read error logs if available
    try {
      const errorLogs = await fs.readFile(errorLogPath, 'utf8');
      const errorLogLines = errorLogs.split('\n').slice(-logLimit);
      if (logs) logs += '\n';
      logs += errorLogLines.join('\n');
    } catch (error) {
      console.warn(`Could not read error logs for ${processName}:`, error.message);
    }
    
    return logs || `No logs found for ${processName}`;
  } catch (error) {
    console.error(`Error getting logs for ${processName}:`, error);
    throw error;
  }
}

// GET /processes - List all processes
app.get('/processes', async (req, res) => {
  try {
    await pm2Connect();
    const processes = await pm2List();
    
    // Format process data to include only relevant information
    const formattedProcesses = processes.map(p => ({
      name: p.name,
      pid: p.pid,
      status: p.pm2_env?.status || 'unknown',
      uptime: p.pm2_env?.pm_uptime ? Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
      restarts: p.pm2_env?.restart_time || 0,
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0
    }));
    
    res.json(formattedProcesses);
  } catch (error) {
    console.error('Error listing processes:', error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// GET /processes/:name/status - Get status of a specific process
app.get('/processes/:name/status', async (req, res) => {
  const { name } = req.params;
  
  try {
    await pm2Connect();
    const processes = await pm2List();
    const process = processes.find(p => p.name === name);
    
    if (!process) {
      return res.status(404).json({ error: `Process ${name} not found` });
    }
    
    const status = {
      name: process.name,
      pid: process.pid,
      status: process.pm2_env?.status || 'unknown',
      uptime: process.pm2_env?.pm_uptime ? Math.floor((Date.now() - process.pm2_env.pm_uptime) / 1000) : 0,
      restarts: process.pm2_env?.restart_time || 0,
      memory: process.monit?.memory || 0,
      cpu: process.monit?.cpu || 0,
      env: process.pm2_env?.env || {}
    };
    
    res.json(status);
  } catch (error) {
    console.error(`Error getting status for ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// POST /processes/:name/start - Start a specific process
app.post('/processes/:name/start', async (req, res) => {
  const { name } = req.params;
  const options = req.body || {};
  
  try {
    await pm2Connect();
    
    // Check if process already exists
    const processes = await pm2List();
    const existingProcess = processes.find(p => p.name === name);
    
    if (existingProcess) {
      // If exists but is stopped, restart it
      if (existingProcess.pm2_env?.status !== 'online') {
        // If options include env, update the environment variables
        if (options.env) {
          // For simplicity, we'll restart with the new env variables
          await pm2Stop(name);
          await pm2Start({
            name,
            script: existingProcess.pm2_env?.pm_exec_path,
            env: options.env
          });
        } else {
          await pm2Restart(name);
        }
      } else {
        // Already running, just update env if provided
        if (options.env) {
          // To update env variables for a running process, we need to restart it
          await pm2Restart({
            name,
            updateEnv: true,
            env: options.env
          });
        }
      }
    } else {
      // Process doesn't exist, try to start it
      // Note: This requires the process to be defined in ecosystem config or script path provided
      if (!options.script && !options.scriptPath) {
        return res.status(400).json({ error: 'Cannot start non-existent process without script path' });
      }
      
      await pm2Start({
        name,
        script: options.script || options.scriptPath,
        env: options.env || {}
      });
    }
    
    const updatedProcesses = await pm2List();
    const startedProcess = updatedProcesses.find(p => p.name === name);
    
    res.json({
      success: true,
      name,
      status: startedProcess?.pm2_env?.status || 'starting',
      message: `Process ${name} started successfully`
    });
  } catch (error) {
    console.error(`Error starting ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// POST /processes/:name/stop - Stop a specific process
app.post('/processes/:name/stop', async (req, res) => {
  const { name } = req.params;
  
  try {
    await pm2Connect();
    await pm2Stop(name);
    
    res.json({
      success: true,
      name,
      status: 'stopped',
      message: `Process ${name} stopped successfully`
    });
  } catch (error) {
    console.error(`Error stopping ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// POST /processes/:name/restart - Restart a specific process
app.post('/processes/:name/restart', async (req, res) => {
  const { name } = req.params;
  
  try {
    await pm2Connect();
    await pm2Restart(name);
    
    res.json({
      success: true,
      name,
      status: 'restarted',
      message: `Process ${name} restarted successfully`
    });
  } catch (error) {
    console.error(`Error restarting ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// GET /processes/:name/logs - Get logs for a specific process
app.get('/processes/:name/logs', async (req, res) => {
  const { name } = req.params;
  const lines = parseInt(req.query.lines || '100', 10);
  
  try {
    await pm2Connect();
    const logs = await getProcessLogs(name, lines);
    
    res.json({
      success: true,
      name,
      logs
    });
  } catch (error) {
    console.error(`Error getting logs for ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// POST /processes/:name/env - Update environment variables for a specific process
app.post('/processes/:name/env', async (req, res) => {
  const { name } = req.params;
  const { env } = req.body;
  
  if (!env || typeof env !== 'object') {
    return res.status(400).json({ error: 'Environment variables must be provided as an object' });
  }
  
  try {
    await pm2Connect();
    
    // Check if process exists
    const processes = await pm2List();
    const process = processes.find(p => p.name === name);
    
    if (!process) {
      return res.status(404).json({ error: `Process ${name} not found` });
    }
    
    // To update env variables, we need to restart the process with the new env
    await pm2Restart({
      name,
      updateEnv: true,
      env
    });
    
    res.json({
      success: true,
      name,
      message: `Environment variables updated for ${name}`,
      env
    });
  } catch (error) {
    console.error(`Error updating env variables for ${name}:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    pm2Disconnect();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start the server
app.listen(PORT, () => {
  console.log(`PM2 API server running on port ${PORT}`);
});

module.exports = app;
