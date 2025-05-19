
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, AlertTriangle, CheckCircle, WifiOff, Clock, Activity, RefreshCw, Settings } from 'lucide-react';
import { TokenInfo } from '@/Arbitrum/utils/types';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenericBotControlPanelProps {
  botType: string;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent: number;
  };
  baseToken: TokenInfo;
  profitThreshold: number;
  isStarting?: boolean;
  isStopping?: boolean;
}

const GenericBotControlPanel: React.FC<GenericBotControlPanelProps> = ({
  botType,
  isRunning,
  onStart,
  onStop,
  stats,
  baseToken,
  profitThreshold,
  isStarting = false,
  isStopping = false
}) => {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pm2Status, setPm2Status] = useState<'online' | 'stopped' | 'unknown'>('unknown');
  
  // Format currency values to 4 decimal places
  const formatCurrency = (value: number) => {
    return value.toFixed(4);
  };

  // Function to check PM2 status
  const checkPm2Status = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
        body: { action: 'pm2Status' }
      });
      
      if (error) throw error;
      
      setPm2Status(data?.status || 'unknown');
      
      toast({
        title: "PM2 Status Updated",
        description: `Bot is ${data?.status || 'unknown'} in PM2`,
      });
    } catch (err) {
      console.error("Failed to check PM2 status:", err);
      toast({
        title: "Failed to check PM2 status",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
      setPm2Status('unknown');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to start bot with PM2
  const handleStartWithPm2 = async () => {
    if (isRunning || isStarting) return;
    
    try {
      // Call the edge function to start the bot with PM2
      const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
        body: {
          action: 'pm2Start',
          config: {
            baseToken: baseToken,
            profitThreshold: profitThreshold,
            gasMultiplier: 1.2,
            maxGasPrice: 30
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Bot Started with PM2",
        description: `${botType} bot is now running with PM2`,
      });
      
      // Wait a moment before checking status
      setTimeout(checkPm2Status, 2000);
      
      // Call the original onStart function
      onStart();
    } catch (err) {
      console.error(`Failed to start ${botType} bot with PM2:`, err);
      toast({
        title: "Failed to start bot with PM2",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    }
  };

  // Function to stop bot with PM2
  const handleStopWithPm2 = async () => {
    if (!isRunning || isStopping) return;
    
    try {
      // Call the edge function to stop the bot with PM2
      const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
        body: {
          action: 'pm2Stop'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Bot Stopped with PM2",
        description: `${botType} bot has been stopped in PM2`,
      });
      
      // Wait a moment before checking status
      setTimeout(checkPm2Status, 2000);
      
      // Call the original onStop function
      onStop();
    } catch (err) {
      console.error(`Failed to stop ${botType} bot with PM2:`, err);
      toast({
        title: "Failed to stop bot with PM2",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    }
  };

  // Check PM2 status on initial load
  useEffect(() => {
    checkPm2Status();
    // Set up interval to check status periodically (every 30 seconds)
    const interval = setInterval(checkPm2Status, 30000);
    return () => clearInterval(interval);
  }, [botType]);

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center gap-2">
            <Activity className="size-5" /> {botType.charAt(0).toUpperCase() + botType.slice(1)} Bot Control
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              className={`${isRunning ? 'bg-green-600' : isStarting ? 'bg-yellow-600' : isStopping ? 'bg-orange-600' : 'bg-red-600'} text-white px-3 py-1`}
            >
              {isRunning ? 'RUNNING' : isStarting ? 'STARTING' : isStopping ? 'STOPPING' : 'STOPPED'}
            </Badge>
            <Badge 
              className={`${pm2Status === 'online' ? 'bg-emerald-600' : pm2Status === 'stopped' ? 'bg-gray-600' : 'bg-blue-600'} text-white px-2 py-0.5 text-xs`}
            >
              PM2: {pm2Status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-crypto-darker p-4 rounded-md border border-crypto-border">
            <p className="text-xs text-muted-foreground">Total Profit</p>
            <p className="text-2xl font-bold text-neon-green">{formatCurrency(stats.totalProfit)} ETH</p>
          </div>
          <div className="bg-crypto-darker p-4 rounded-md border border-crypto-border">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-2xl font-bold text-neon-blue">{stats.successRate.toFixed(1)}%</p>
          </div>
          <div className="bg-crypto-darker p-4 rounded-md border border-crypto-border">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold text-neon-yellow">{stats.totalTxs}</p>
          </div>
        </div>
        
        {/* Current Configuration */}
        <div className="mb-6 bg-crypto-darker p-4 rounded-md border border-crypto-border">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-neon-green" /> Active Configuration
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Base Token</p>
              <p className="text-sm">{baseToken.symbol} ({baseToken.address.substring(0, 6)}...{baseToken.address.substring(baseToken.address.length - 4)})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Min. Profit Threshold</p>
              <p className="text-sm">{profitThreshold} ETH</p>
            </div>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="default"
            className={`${isRunning || isStarting ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            onClick={handleStartWithPm2}
            disabled={isRunning || isStarting || isStopping}
          >
            {isStarting ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" /> Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Start Bot
              </>
            )}
          </Button>
          <Button
            variant="default"
            className={`${!isRunning || isStopping ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
            onClick={handleStopWithPm2}
            disabled={!isRunning || isStopping || isStarting}
          >
            {isStopping ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" /> Stopping...
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" /> Stop Bot
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="border-blue-500 text-blue-400 hover:bg-blue-900/20"
            onClick={checkPm2Status}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            PM2 Status
          </Button>
        </div>

        {/* Additional PM2 Controls */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Button
            variant="outline"
            className="border-cyan-500 text-cyan-400 hover:bg-cyan-900/20"
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
                  body: { action: 'pm2Logs' }
                });
                
                if (error) throw error;
                
                toast({
                  title: "PM2 Logs Requested",
                  description: "Check server console for logs",
                });
              } catch (err) {
                toast({
                  title: "Failed to get PM2 logs",
                  description: err.message || "An error occurred",
                  variant: "destructive"
                });
              }
            }}
          >
            <Settings className="mr-2 h-4 w-4" /> View Logs
          </Button>
          <Button
            variant="outline"
            className="border-purple-500 text-purple-400 hover:bg-purple-900/20"
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke(`${botType}-bot-control`, {
                  body: { action: 'pm2Restart' }
                });
                
                if (error) throw error;
                
                toast({
                  title: "PM2 Bot Restarted",
                  description: `${botType} bot has been restarted`,
                });
                
                // Wait a moment before checking status
                setTimeout(checkPm2Status, 2000);
              } catch (err) {
                toast({
                  title: "Failed to restart bot",
                  description: err.message || "An error occurred",
                  variant: "destructive"
                });
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Restart Bot
          </Button>
        </div>

        {/* Connection Status */}
        <div className="mt-6 text-center">
          {isRunning ? (
            <div className="flex items-center justify-center text-neon-green text-sm">
              <Activity className="h-4 w-4 mr-1 animate-pulse" /> Bot is actively monitoring for opportunities
            </div>
          ) : isStarting ? (
            <div className="flex items-center justify-center text-yellow-400 text-sm">
              <Clock className="h-4 w-4 mr-1 animate-spin" /> Initializing bot modules...
            </div>
          ) : isStopping ? (
            <div className="flex items-center justify-center text-orange-400 text-sm">
              <Clock className="h-4 w-4 mr-1 animate-spin" /> Shutting down bot modules...
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-400 text-sm">
              <WifiOff className="h-4 w-4 mr-1" /> Bot is currently inactive
            </div>
          )}
        </div>
        
        {/* PM2 Status Info */}
        <div className="mt-2 text-center">
          <div className={`
            text-xs 
            ${pm2Status === 'online' ? 'text-emerald-400' : 
              pm2Status === 'stopped' ? 'text-gray-400' : 'text-blue-400'}
          `}>
            PM2 Process Status: {pm2Status.toUpperCase()}
          </div>
        </div>
        
        {/* Warning for live trading */}
        <div className="mt-6 p-2 border border-yellow-500/30 bg-yellow-500/10 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-xs text-yellow-500/90">
              This bot will execute real transactions on the Arbitrum network using your configured wallet. 
              Make sure you have enough ETH for gas and transaction costs.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GenericBotControlPanel;
