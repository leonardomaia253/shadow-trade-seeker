
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Activity, TrendingUp, BarChart, CircleDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BotControlPanelProps {
  botType: 'arbitrage' | 'profiter-one' | 'profiter-two' | 'liquidation' | 'frontrun' | 'sandwich';
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent?: number;
    is_running?: boolean;
  };
  baseToken: any;
  profitThreshold: number;
}

const GenericBotControlPanel = ({ botType, isRunning, onStart, onStop, stats, baseToken, profitThreshold }: BotControlPanelProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const getBotTitle = () => {
    switch(botType) {
      case 'arbitrage': return 'Arbitrage Bot Control';
      case 'profiter-one': return 'Profiter One Control';
      case 'profiter-two': return 'Profiter Two Control';
      case 'liquidation': return 'Liquidation Bot Control';
      case 'frontrun': return 'Frontrun Bot Control';
      case 'sandwich': return 'Sandwich Bot Control';
      default: return 'Bot Control Center';
    }
  };
  
  const getControlEndpoint = () => {
    switch(botType) {
      case 'arbitrage': return 'arbitrage-bot-control';
      case 'profiter-one': return 'profiter-one-bot-control';
      case 'profiter-two': return 'profiter-two-bot-control';
      case 'liquidation': return 'liquidation-bot-control';
      case 'frontrun': return 'frontrun-bot-control';
      case 'sandwich': return 'sandwich-bot-control';
      default: return 'arbitrage-bot-control';
    }
  };
  
  const handleStart = async () => {
    if (isRunning || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // Log UI action
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: 'Start button clicked',
        category: 'user_action',
        bot_type: botType,
        source: 'user'
      });
      
      // Call the edge function to start the bot with configuration
      const { data, error } = await supabase.functions.invoke(getControlEndpoint(), {
        body: {
          action: 'start',
          config: {
            baseToken: baseToken,
            profitThreshold: profitThreshold
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Bot Started",
        description: `${getBotTitle()} is now running and searching for opportunities`,
      });
      
      onStart();
    } catch (err) {
      console.error(`Failed to start ${botType} bot:`, err);
      
      // Log the error
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Failed to start bot: ${err.message || 'Unknown error'}`,
        category: 'user_action',
        bot_type: botType,
        source: 'user',
        metadata: { error: err.message, stack: err.stack }
      });
      
      toast({
        title: "Failed to start bot",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleStop = async () => {
    if (!isRunning || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // Log UI action
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: 'Stop button clicked',
        category: 'user_action',
        bot_type: botType,
        source: 'user'
      });
      
      // Call the edge function to stop the bot
      const { data, error } = await supabase.functions.invoke(getControlEndpoint(), {
        body: {
          action: 'stop'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Bot Stopped",
        description: `${getBotTitle()} has been stopped`,
      });
      
      onStop();
    } catch (err) {
      console.error(`Failed to stop ${botType} bot:`, err);
      
      // Log the error
      await supabase.from('bot_logs').insert({
        level: 'error',
        message: `Failed to stop bot: ${err.message || 'Unknown error'}`,
        category: 'user_action', 
        bot_type: botType,
        source: 'user',
        metadata: { error: err.message, stack: err.stack }
      });
      
      toast({
        title: "Failed to stop bot",
        description: err.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <Activity className="mr-2" /> {getBotTitle()}
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
                onClick={handleStart} 
                disabled={isRunning || isProcessing}
                className={`bg-neon-green hover:bg-neon-green/80 text-black ${isRunning || isProcessing ? 'opacity-50' : ''}`}
              >
                {isProcessing ? (
                  <span className="animate-pulse">Processing...</span>
                ) : (
                  <>
                    <Play className="mr-1 h-4 w-4" /> Start
                  </>
                )}
              </Button>
              <Button 
                onClick={handleStop} 
                disabled={!isRunning || isProcessing}
                className={`bg-red-500 hover:bg-red-600 text-white ${!isRunning || isProcessing ? 'opacity-50' : ''}`}
              >
                {isProcessing ? (
                  <span className="animate-pulse">Processing...</span>
                ) : (
                  <>
                    <span className="mr-1">■</span> Stop
                  </>
                )}
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

export default GenericBotControlPanel;
