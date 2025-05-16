
import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from '@/components/DashboardHeader';
import BotControlPanel from '@/components/BotControlPanel';
import OpportunitiesTable from '@/components/OpportunitiesTable';
import BotConfiguration from '@/components/BotConfiguration';
import BotPerformance from '@/components/BotPerformance';
import { TokenInfo } from '@/Arbitrum/utils/types';
import { enhancedLogger } from '@/Arbitrum/utils/enhancedLogger';

const ArbitrageBot = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [baseToken, setBaseToken] = useState<TokenInfo>({
    address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    symbol: "WETH",
    decimals: 18,
  });
  
  const [profitThreshold, setProfitThreshold] = useState(0.001);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalProfit: 0,
    successRate: 0,
    avgProfit: 0,
    totalTxs: 0
  });

  // Fetch bot transactions from Supabase
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('bot_transactions')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .order('timestamp', { ascending: false })
          .limit(10);
          
        if (error) throw error;
        if (data) setTransactions(data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast({
          title: "Failed to load transactions",
          description: "Could not connect to database",
          variant: "destructive"
        });
      }
    };
    
    fetchTransactions();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('arbitrage-bot-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            setTransactions(current => [payload.new, ...current.slice(0, 9)]);
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Fetch bot statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .single();
          
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
        if (data) {
          setStats({
            totalProfit: data.total_profit || 0,
            successRate: data.success_rate || 0,
            avgProfit: data.average_profit || 0,
            totalTxs: data.transactions_count || 0,
            gasSpent: data.gas_spent || 0
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    
    fetchStats();
    
    const channel = supabase
      .channel('arbitrage-stats-updates')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'bot_statistics', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            setStats({
              totalProfit: payload.new.total_profit || 0,
              successRate: payload.new.success_rate || 0,
              avgProfit: payload.new.average_profit || 0,
              totalTxs: payload.new.transactions_count || 0,
              gasSpent: payload.new.gas_spent || 0
            });
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStartBot = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    enhancedLogger.info("Bot started");
    toast({
      title: "Bot Started",
      description: "Arbitrage bot is now running and searching for opportunities",
    });
    
    // In a real implementation, we would start the bot process here
    // For now, we'll just simulate activity by logging to the database
    const logBotStart = async () => {
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: 'Arbitrage bot started',
        category: 'bot_state',
        bot_type: 'arbitrage',
        source: 'user'
      });
    };
    
    logBotStart();
  };

  const handleStopBot = () => {
    if (!isRunning) return;
    
    setIsRunning(false);
    enhancedLogger.info("Bot stopped");
    toast({
      title: "Bot Stopped",
      description: "Arbitrage bot has been stopped",
    });
    
    // In a real implementation, we would stop the bot process here
    const logBotStop = async () => {
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: 'Arbitrage bot stopped',
        category: 'bot_state',
        bot_type: 'arbitrage',
        source: 'user'
      });
    };
    
    logBotStop();
  };

  const handleUpdateConfig = (config: any) => {
    setBaseToken(config.baseToken);
    setProfitThreshold(config.profitThreshold);
    
    toast({
      title: "Configuration Updated",
      description: "Bot configuration has been updated",
    });
    
    // Log configuration changes
    const logConfigChange = async () => {
      await supabase.from('bot_logs').insert({
        level: 'info',
        message: 'Bot configuration updated',
        category: 'configuration',
        bot_type: 'arbitrage',
        source: 'user',
        metadata: { baseToken: config.baseToken.symbol, profitThreshold: config.profitThreshold }
      });
    };
    
    logConfigChange();
  };

  return (
    <div className="min-h-screen bg-crypto-darker text-foreground font-mono">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl mb-6 font-bold text-neon-blue">Arbitrage Bot Control</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <BotConfiguration 
              baseToken={baseToken}
              profitThreshold={profitThreshold}
              onUpdateConfig={handleUpdateConfig}
            />
          </div>
          <div className="lg:col-span-2">
            <BotControlPanel 
              isRunning={isRunning} 
              onStart={handleStartBot} 
              onStop={handleStopBot} 
              stats={stats}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OpportunitiesTable transactions={transactions} />
          </div>
          <div className="lg:col-span-1">
            <BotPerformance stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArbitrageBot;
