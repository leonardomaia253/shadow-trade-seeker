
module.exports = {
  apps: [
    {
      name: "profiter-two",
      script: "./index.ts",
      interpreter: "ts-node",
      watch: false,
      env: {
        NODE_ENV: "production",
        HEALTH_PORT: 3001,
      },
      // Automatically restart the bot if it crashes
      autorestart: true,
      // Restart if memory usage goes above threshold
      max_memory_restart: "1G",
      // Set up comprehensive logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      merge_logs: true,
      // Additional settings for connection resiliency
      restart_delay: 5000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      // Include profiling for potential performance optimizations
      node_args: [
        "--trace-warnings",
        "--max-old-space-size=2048", // Limit memory usage
        // Uncomment below for enhanced debugging if needed
        // "--inspect",
      ],
      // Health check endpoint
      health_check: {
        url: "http://localhost:3001/health",
        protocol: "http",
        port: 3001,
        path: "/health",
        interval: 30000, // 30 seconds
        timeout: 5000, // 5 seconds
      },
      // Graceful shutdown
      kill_timeout: 10000, // Give the app 10 seconds to gracefully terminate
      shutdown_with_message: true, // Allow the process to cleanup when receiving a shutdown signal
      // Advanced monitoring options
      instances: 1, // Number of instances to launch
      instance_var: "INSTANCE_ID", // Name of the environment variable with the instance id
      wait_ready: true, // Wait for process.send('ready') before considering process online
      listen_timeout: 30000, // Time to wait for process.send('ready') before considering process failed
      // Automatic reload on specific errors
      auto_reload: {
        pattern: "Error: All providers failed for",
        max_reload: 10,
        delay: 5000
      },
      // Metrics collection
      metrics: {
        http: {
          port: 9209,
          path: "/metrics"
        }
      }
    },
  ],
};
