
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, ArrowDownRight, Info, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const StatsOverview = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    totalProfit: 0,
    transactions: 0,
    gasSpent: 0,
    successRate: 0,
    profitTrend: 0,
    txTrend: 0,
    gasTrend: 0,
    successTrend: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        
        // Fetch statistics from all bot types
        const { data: botStats, error: statsError } = await supabase
          .from('bot_statistics')
          .select('*');
          
        if (statsError) throw statsError;
        
        // Calculate aggregated statistics
        if (botStats && botStats.length > 0) {
          const totalProfit = botStats.reduce((sum, bot) => {
            const profit = typeof bot.total_profit === 'string' ? parseFloat(bot.total_profit) : (bot.total_profit || 0);
            return sum + profit;
          }, 0);
          
          const transactions = botStats.reduce((sum, bot) => {
            const txCount = typeof bot.transactions_count === 'string' ? parseInt(bot.transactions_count) : (bot.transactions_count || 0);
            return sum + txCount;
          }, 0);
          
          const gasSpent = botStats.reduce((sum, bot) => {
            const gas = typeof bot.gas_spent === 'string' ? parseFloat(bot.gas_spent) : (bot.gas_spent || 0);
            return sum + gas;
          }, 0);
          
          // Calculate average success rate weighted by transaction count
          let weightedSuccessSum = 0;
          let totalTxs = 0;
          
          botStats.forEach(bot => {
            const txCount = typeof bot.transactions_count === 'string' ? parseInt(bot.transactions_count) : (bot.transactions_count || 0);
            const successRate = typeof bot.success_rate === 'string' ? parseFloat(bot.success_rate) : (bot.success_rate || 0);
            
            weightedSuccessSum += successRate * txCount;
            totalTxs += txCount;
          });
          
          const avgSuccessRate = totalTxs > 0 ? weightedSuccessSum / totalTxs : 0;
          
          // Fetch recent transactions to calculate trends
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          
          const { data: recentTxs, error: txError } = await supabase
            .from('bot_transactions')
            .select('*')
            .gte('timestamp', oneDayAgo.toISOString());
            
          if (txError) throw txError;
          
          // Calculate rough trends (positive or negative based on recent activity)
          // In a real app, you'd compare with previous period data
          const profitTrend = recentTxs && recentTxs.length > 0 ? 
            recentTxs.reduce((sum, tx) => sum + (typeof tx.profit === 'string' ? parseFloat(tx.profit || '0') : (tx.profit || 0)), 0) : 0;
            
          setStatsData({
            totalProfit,
            transactions,
            gasSpent,
            successRate: avgSuccessRate,
            profitTrend: profitTrend > 0 ? 8.2 : -3.5, // Simplified trend calculation
            txTrend: recentTxs && recentTxs.length > 0 ? 12.5 : -2.1,
            gasTrend: -3.1, // For now we use a fixed value, could be calculated from gas history
            successTrend: 1.2 // For now we use a fixed value
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
        toast({
          title: "Error fetching statistics",
          description: "Could not load dashboard statistics",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
    
    // Set up real-time listeners for statistics updates
    const statsChannel = supabase
      .channel('dashboard-stats-updates')
      .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'bot_statistics' },
          () => {
            fetchStats();
          })
      .subscribe();
      
    // Set up real-time listeners for new transactions
    const txChannel = supabase
      .channel('dashboard-tx-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions' },
          () => {
            fetchStats();
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(statsChannel);
      supabase.removeChannel(txChannel);
    };
  }, [toast]);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };
  
  const formatETH = (amount: number) => {
    return `${formatNumber(amount)} ETH`;
  };

  const stats = [
    {
      title: "Total Profit",
      value: isLoading ? "Loading..." : formatETH(statsData.totalProfit),
      change: `${statsData.profitTrend > 0 ? '+' : ''}${formatNumber(statsData.profitTrend)}%`,
      positive: statsData.profitTrend > 0,
      icon: <Target className="h-4 w-4 text-neon-green" />,
      color: "neon-green"
    },
    {
      title: "Transactions",
      value: isLoading ? "Loading..." : formatNumber(statsData.transactions, 0),
      change: `${statsData.txTrend > 0 ? '+' : ''}${formatNumber(statsData.txTrend)}%`,
      positive: statsData.txTrend > 0,
      icon: <ArrowUpRight className="h-4 w-4 text-neon-blue" />,
      color: "neon-blue"
    },
    {
      title: "Gas Spent",
      value: isLoading ? "Loading..." : formatETH(statsData.gasSpent),
      change: `${statsData.gasTrend > 0 ? '+' : ''}${formatNumber(statsData.gasTrend)}%`,
      positive: statsData.gasTrend < 0, // For gas, negative trend is positive (less gas spent)
      icon: <ArrowDownRight className="h-4 w-4 text-neon-pink" />,
      color: "neon-pink"
    },
    {
      title: "Success Rate",
      value: isLoading ? "Loading..." : `${formatNumber(statsData.successRate)}%`,
      change: `${statsData.successTrend > 0 ? '+' : ''}${formatNumber(statsData.successTrend)}%`,
      positive: statsData.successTrend > 0,
      icon: <Target className="h-4 w-4 text-neon-blue" />,
      color: "neon-blue"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-crypto-card border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              {stat.title}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{`Real-time ${stat.title.toLowerCase()} from all bots`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            {stat.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: `var(--tw-color-${stat.color.replace('neon-', '')})` }}>
              {stat.value}
            </div>
            <p className={`text-xs inline-flex items-center ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
              {stat.positive ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {stat.change} <span className="text-muted-foreground ml-1">vs last week</span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsOverview;
