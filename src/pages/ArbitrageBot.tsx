
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
  const [isLoading, setIsLoading] = useState(true);
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
    totalTxs: 0,
    gasSpent: 0,
    is_running: false
  });

  // Initial fetch of bot state and data
  useEffect(() => {
    const fetchBotData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch bot statistics
        const { data: statsData, error: statsError } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .single();
          
        if (statsError && statsError.code !== 'PGRST116') {
          throw statsError;
        }
        
        if (statsData) {
          setStats({
            totalProfit: parseFloat(statsData.total_profit) || 0,
            successRate: parseFloat(statsData.success_rate) || 0,
            avgProfit: parseFloat(statsData.average_profit) || 0,
            totalTxs: parseInt(statsData.transactions_count) || 0,
            gasSpent: parseFloat(statsData.gas_spent) || 0,
            is_running: statsData.is_running || false
          });
          
          setIsRunning(statsData.is_running || false);
        }
        
        // Fetch recent transactions
        const { data: txData, error: txError } = await supabase
          .from('bot_transactions')
          .select('*')
          .eq('bot_type', 'arbitrage')
          .order('timestamp', { ascending: false })
          .limit(10);
          
        if (txError) throw txError;
        
        if (txData) {
          setTransactions(txData);
        }
        
      } catch (error) {
        console.error('Error fetching bot data:', error);
        toast({
          title: "Failed to load bot data",
          description: "Could not connect to database",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBotData();
    
    // Subscribe to real-time updates for bot statistics
    const statsChannel = supabase
      .channel('arbitrage-stats-updates')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'bot_statistics', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            const newData = payload.new;
            setStats({
              totalProfit: parseFloat(newData.total_profit) || 0,
              successRate: parseFloat(newData.success_rate) || 0,
              avgProfit: parseFloat(newData.average_profit) || 0,
              totalTxs: parseInt(newData.transactions_count) || 0,
              gasSpent: parseFloat(newData.gas_spent) || 0,
              is_running: newData.is_running || false
            });
            
            setIsRunning(newData.is_running || false);
          })
      .subscribe();
      
    // Subscribe to real-time updates for transactions
    const txChannel = supabase
      .channel('arbitrage-transactions-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            setTransactions(prev => [payload.new, ...prev.slice(0, 9)]);
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(statsChannel);
      supabase.removeChannel(txChannel);
    };
  }, [toast]);

  const handleStartBot = async () => {
    if (isRunning) return;
    
    enhancedLogger.info("Starting arbitrage bot");
    setIsRunning(true);
  };

  const handleStopBot = async () => {
    if (!isRunning) return;
    
    enhancedLogger.info("Stopping arbitrage bot");
    setIsRunning(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-crypto-darker text-foreground font-mono flex items-center justify-center">
        <div className="text-neon-blue animate-pulse">Loading bot data...</div>
      </div>
    );
  }

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
              baseToken={baseToken}
              profitThreshold={profitThreshold}
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
