
module.exports = {
  apps: [
    {
      name: "arbitrage-bot",
      script: "./index.ts",
      interpreter: "ts-node",
      watch: false,
      env: {
        NODE_ENV: "production",
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
        // Uncomment below for enhanced debugging if needed
        // "--inspect",
      ],
    },
  ],
};
