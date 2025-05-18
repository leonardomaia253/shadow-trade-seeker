
# Arbitrage Bot Setup

This arbitrage bot is designed to run 24/7 and integrate with the web interface for configuration and monitoring.

## Prerequisites

- Node.js 16+ installed
- PM2 installed globally (`npm install -g pm2`)
- ts-node installed (`npm install -g ts-node`)

## Setup Instructions

1. **Configure the .env file:**

   Copy the sample .env file and fill in your actual values:

   ```
   cp .env.sample .env
   ```

   Edit the .env file to include your:
   - Alchemy API key for websocket connection
   - Private key for transaction signing
   - Tenderly credentials (if using simulation)
   - Supabase credentials for database access

2. **Install dependencies:**

   ```
   npm install
   ```

3. **Start the bot with PM2:**

   ```
   pm2 start ecosystem.config.ts
   ```

4. **Monitor the bot:**

   ```
   pm2 logs arbitrage-bot
   ```

   You can also monitor the bot through the web interface.

## PM2 Common Commands

- Check status: `pm2 status`
- Stop the bot: `pm2 stop arbitrage-bot`
- Restart the bot: `pm2 restart arbitrage-bot`
- View detailed logs: `pm2 logs arbitrage-bot`
- Monitor resources: `pm2 monit`

## Integration with Web Interface

This bot automatically synchronizes with the web interface by:

1. Checking the database for start/stop commands
2. Using configuration parameters set in the UI
3. Logging all activities and transactions to the database
4. Updating statistics that are displayed in the dashboard

No manual intervention is needed after initial setup - the bot will respond to all commands from the web interface.

## Troubleshooting

If the bot fails to connect to Supabase, verify:
- Your SUPABASE_URL and SUPABASE_KEY in .env are correct
- Internet connectivity is stable
- Your Supabase instance is online

For WebSocket connection issues:
- Verify your Alchemy API key is valid
- Check if network conditions are causing disconnects
- Make sure the bot has sufficient memory/resources

## Security Notes

- Keep your .env file secure and never commit it to repositories
- The private key in .env has complete control of the wallet, ensure server security
- Consider using a hardware wallet for production deployments
