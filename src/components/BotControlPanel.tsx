
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Stop, Activity, TrendingUp, BarChart, CircleDollarSign } from "lucide-react";

interface BotControlPanelProps {
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent?: number;
  };
}

const BotControlPanel = ({ isRunning, onStart, onStop, stats }: BotControlPanelProps) => {
  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <Activity className="mr-2" /> Bot Control Center
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted-foreground">Bot Status</div>
              <div className="flex items-center mt-1">
                {isRunning ? (
                  <>
                    <div className="h-3 w-3 rounded-full bg-neon-green mr-2 animate-pulse"></div>
                    <span className="text-neon-green font-semibold">Running</span>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
                    <span className="text-red-500 font-semibold">Stopped</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={onStart} 
                disabled={isRunning}
                className={`bg-neon-green hover:bg-neon-green/80 text-black ${isRunning ? 'opacity-50' : ''}`}
              >
                <Play className="mr-1 h-4 w-4" /> Start
              </Button>
              <Button 
                onClick={onStop} 
                disabled={!isRunning}
                className={`bg-red-500 hover:bg-red-600 text-white ${!isRunning ? 'opacity-50' : ''}`}
              >
                <Stop className="mr-1 h-4 w-4" /> Stop
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-crypto-border">
            <div className="text-center p-3 bg-crypto-darker rounded-md">
              <div className="text-xs text-muted-foreground">Total Profit</div>
              <div className="flex items-center justify-center mt-1">
                <CircleDollarSign className="h-4 w-4 text-neon-green mr-1" />
                <span className="text-neon-green font-semibold">{stats.totalProfit.toFixed(4)} ETH</span>
              </div>
            </div>
            <div className="text-center p-3 bg-crypto-darker rounded-md">
              <div className="text-xs text-muted-foreground">Success Rate</div>
              <div className="flex items-center justify-center mt-1">
                <TrendingUp className="h-4 w-4 text-neon-blue mr-1" />
                <span className="text-neon-blue font-semibold">{stats.successRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-center p-3 bg-crypto-darker rounded-md">
              <div className="text-xs text-muted-foreground">Average Profit</div>
              <div className="flex items-center justify-center mt-1">
                <BarChart className="h-4 w-4 text-neon-pink mr-1" />
                <span className="text-neon-pink font-semibold">{stats.avgProfit.toFixed(4)} ETH</span>
              </div>
            </div>
            <div className="text-center p-3 bg-crypto-darker rounded-md">
              <div className="text-xs text-muted-foreground">Transactions</div>
              <div className="flex items-center justify-center mt-1">
                <Activity className="h-4 w-4 text-neon-purple mr-1" />
                <span className="text-neon-purple font-semibold">{stats.totalTxs}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BotControlPanel;
