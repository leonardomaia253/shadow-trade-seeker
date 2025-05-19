
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, AlertTriangle, CheckCircle, WifiOff, Clock, Activity } from 'lucide-react';
import { TokenInfo } from '@/Arbitrum/utils/types';

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
  // Format currency values to 4 decimal places
  const formatCurrency = (value: number) => {
    return value.toFixed(4);
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center gap-2">
            <Activity className="size-5" /> {botType.charAt(0).toUpperCase() + botType.slice(1)} Bot Control
          </CardTitle>
          <Badge 
            className={`${isRunning ? 'bg-green-600' : isStarting ? 'bg-yellow-600' : isStopping ? 'bg-orange-600' : 'bg-red-600'} text-white px-3 py-1`}
          >
            {isRunning ? 'RUNNING' : isStarting ? 'STARTING' : isStopping ? 'STOPPING' : 'STOPPED'}
          </Badge>
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
        <div className="flex gap-4">
          <Button
            variant="default"
            className={`flex-1 ${isRunning || isStarting ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            onClick={onStart}
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
            className={`flex-1 ${!isRunning || isStopping ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
            onClick={onStop}
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
