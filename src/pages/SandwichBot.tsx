import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DashboardHeader from '@/components/DashboardHeader';
import GenericBotControlPanel from '@/components/GenericBotControlPanel';
import OpportunitiesTable from '@/components/OpportunitiesTable';
import BotConfiguration from '@/components/BotConfiguration';
import BotPerformance from '@/components/BotPerformance';
import BotLogsViewer from '@/components/BotLogsViewer';
import BotNavigation from '@/components/BotNavigation';
import { TokenInfo } from '@/Arbitrum/utils/types';

// Define the bot statistics type to match the database schema
interface BotStatistics {
  id: string;
  bot_type: string;
  total_profit: string | number;
  success_rate: string | number;
  average_profit: string | number;
  gas_spent: string | number;
  transactions_count: string | number;
  updated_at: string;
  is_running?: boolean;
}

const SandwichBot = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleStatus, setModuleStatus] = useState({
    scanner: 'inactive',
    builder: 'inactive',
    executor: 'inactive'
  });
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
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Initial fetch of bot state and data
  useEffect(() => {
    const fetchBotData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch bot statistics
        const { data: statsData, error: statsError } = await supabase
          .from('bot_statistics')
          .select('*')
          .eq('bot_type', 'sandwich')
          .single();
          
        if (statsError && statsError.code !== 'PGRST116') {
          throw statsError;
        }
        
        if (statsData) {
          const typedStatsData = statsData as BotStatistics;
          setStats({
            totalProfit: typeof typedStatsData.total_profit === 'string' ? parseFloat(typedStatsData.total_profit) : (typedStatsData.total_profit || 0),
            successRate: typeof typedStatsData.success_rate === 'string' ? parseFloat(typedStatsData.success_rate) : (typedStatsData.success_rate || 0),
            avgProfit: typeof typedStatsData.average_profit === 'string' ? parseFloat(typedStatsData.average_profit) : (typedStatsData.average_profit || 0),
            totalTxs: typeof typedStatsData.transactions_count === 'string' ? parseInt(typedStatsData.transactions_count) : (typedStatsData.transactions_count || 0),
            gasSpent: typeof typedStatsData.gas_spent === 'string' ? parseFloat(typedStatsData.gas_spent) : (typedStatsData.gas_spent || 0),
            is_running: typedStatsData.is_running || false
          });
          
          setIsRunning(typedStatsData.is_running || false);
          setLastUpdate(new Date(typedStatsData.updated_at).toLocaleString());
        } else {
          // Initialize stats in database if not exist
          await supabase.from('bot_statistics').insert({
            bot_type: 'sandwich',
            total_profit: 0,
            success_rate: 0,
            average_profit: 0,
            gas_spent: 0,
            transactions_count: 0,
            is_running: false,
            updated_at: new Date().toISOString()
          });
        }
        
        // Fetch module status from logs
        const { data: statusLogs } = await supabase
          .from('bot_logs')
          .select('*')
          .eq('bot_type', 'sandwich')
          .in('category', ['initialization', 'shutdown'])
          .order('timestamp', { ascending: false })
          .limit(10);
          
        if (statusLogs && statusLogs.length > 0) {
          const newModuleStatus = { ...moduleStatus };
          
          // Find most recent logs for each module
          ['scanner', 'builder', 'executor'].forEach(module => {
            const moduleLog = statusLogs.find(log => log.source === module);
            if (moduleLog) {
              newModuleStatus[module] = moduleLog.category === 'initialization' ? 'active' : 'inactive';
            } else {
              newModuleStatus[module] = statsData?.is_running ? 'active' : 'inactive';
            }
          });
          
          setModuleStatus(newModuleStatus);
        }
        
        // Fetch recent transactions
        const { data: txData, error: txError } = await supabase
          .from('bot_transactions')
          .select('*')
          .eq('bot_type', 'sandwich')
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
      .channel('sandwich-stats-updates')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'bot_statistics', filter: 'bot_type=eq.sandwich' },
          (payload) => {
            const newData = payload.new as BotStatistics;
            setStats({
              totalProfit: typeof newData.total_profit === 'string' ? parseFloat(newData.total_profit) : (newData.total_profit || 0),
              successRate: typeof newData.success_rate === 'string' ? parseFloat(newData.success_rate) : (newData.success_rate || 0),
              avgProfit: typeof newData.average_profit === 'string' ? parseFloat(newData.average_profit) : (newData.average_profit || 0),
              totalTxs: typeof newData.transactions_count === 'string' ? parseInt(newData.transactions_count.toString()) : (newData.transactions_count || 0),
              gasSpent: typeof newData.gas_spent === 'string' ? parseFloat(newData.gas_spent) : (newData.gas_spent || 0),
              is_running: newData.is_running || false
            });
            
            setIsRunning(newData.is_running || false);
            setLastUpdate(new Date(newData.updated_at).toLocaleString());
            
            // If the bot just turned on or off, update UI state
            if (newData.is_running && isStarting) {
              setIsStarting(false);
              toast({
                title: "Bot Started Successfully",
                description: "Sandwich Bot is now running and monitoring for opportunities",
                variant: "default"
              });
            } else if (!newData.is_running && isStopping) {
              setIsStopping(false);
              toast({
                title: "Bot Stopped Successfully",
                description: "Sandwich Bot has been stopped",
                variant: "default"
              });
            }
          })
      .subscribe();
      
    // Subscribe to real-time updates for transactions
    const txChannel = supabase
      .channel('sandwich-transactions-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions', filter: 'bot_type=eq.sandwich' },
          (payload) => {
            setTransactions(prev => [payload.new, ...prev.slice(0, 9)]);
          })
      .subscribe();
      
    // Subscribe to real-time updates for module status logs
    const moduleStatusChannel = supabase
      .channel('sandwich-modulestatus-updates')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bot_logs', filter: 'bot_type=eq.sandwich' },
          (payload) => {
            if (['initialization', 'shutdown'].includes(payload.new.category) && 
                ['scanner', 'builder', 'executor'].includes(payload.new.source)) {
              setModuleStatus(prev => ({
                ...prev,
                [payload.new.source]: payload.new.category === 'initialization' ? 'active' : 'inactive'
              }));
            }
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(statsChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(moduleStatusChannel);
    };
  }, [toast, isStarting, isStopping]);

  const handleStartBot = async () => {
    if (isRunning || isStarting) return;
    
    setIsStarting(true);
    
    try {
      // Call Supabase Edge Function to start the bot
      const response = await fetch(`${supabase.functions.url}/sandwich-bot-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'start',
          config: {
            minProfitThreshold: profitThreshold,
            minSlippageThreshold: 0.5, // Default slippage threshold 0.5%
            targetDEXs: ['Uniswap', 'SushiSwap'], // Default DEXs to target
            gasMultiplier: 1.2
          }
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to start bot");
      }
      
      toast({
        title: "Starting Bot",
        description: "The bot is initializing, please wait...",
        variant: "default"
      });
      
      // UI state is updated via realtime subscription when bot actually starts
      
    } catch (error: any) {
      console.error('Error starting bot:', error);
      setIsStarting(false);
      toast({
        title: "Failed to Start Bot",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleStopBot = async () => {
    if (!isRunning || isStopping) return;
    
    setIsStopping(true);
    
    try {
      // Call Supabase Edge Function to stop the bot
      const response = await fetch(`${supabase.functions.url}/sandwich-bot-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'stop'
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to stop bot");
      }
      
      toast({
        title: "Stopping Bot",
        description: "The bot is stopping, please wait...",
        variant: "default"
      });
      
      // UI state is updated via realtime subscription when bot actually stops
      
    } catch (error: any) {
      console.error('Error stopping bot:', error);
      setIsStopping(false);
      toast({
        title: "Failed to Stop Bot",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const handleUpdateConfig = async (config: any) => {
    setBaseToken(config.baseToken);
    setProfitThreshold(config.profitThreshold);
    
    try {
      // Update configuration in database via edge function
      const response = await fetch(`${supabase.functions.url}/sandwich-bot-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'updateConfig',
          config: {
            minProfitThreshold: config.profitThreshold,
            minSlippageThreshold: 0.5,
            targetDEXs: ['Uniswap', 'SushiSwap'],
            gasMultiplier: 1.2,
            baseToken: config.baseToken.symbol
          }
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to update configuration");
      }
      
      toast({
        title: "Configuration Updated",
        description: "Bot configuration has been updated successfully",
      });
      
    } catch (error: any) {
      console.error('Error updating config:', error);
      toast({
        title: "Configuration Update Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-crypto-darker text-foreground font-mono flex items-center justify-center">
        <div className="text-neon-orange animate-pulse">Loading bot data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crypto-darker text-foreground font-mono">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl mb-6 font-bold text-neon-orange">Sandwich Bot Control</h1>
        
        <BotNavigation />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <BotConfiguration 
              baseToken={baseToken}
              profitThreshold={profitThreshold}
              onUpdateConfig={handleUpdateConfig}
            />
          </div>
          <div className="lg:col-span-2">
            <GenericBotControlPanel 
              botType="sandwich"
              isRunning={isRunning} 
              isStarting={isStarting}
              isStopping={isStopping}
              onStart={handleStartBot} 
              onStop={handleStopBot} 
              stats={stats}
              baseToken={baseToken}
              profitThreshold={profitThreshold}
              moduleStatus={moduleStatus}
              lastUpdate={lastUpdate}
            />
          </div>
        </div>
        
        <div className="mb-6">
          <BotLogsViewer botType="sandwich" />
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

export default SandwichBot;
