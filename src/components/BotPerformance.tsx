
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CircleDollarSign } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';

interface BotPerformanceProps {
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent?: number;
  };
}

const BotPerformance = ({ stats }: BotPerformanceProps) => {
  const [chartData, setChartData] = useState<any[]>([]);
  
  useEffect(() => {
    // Fetch transaction history for the chart
    const fetchTransactionHistory = async () => {
      // Get the last 30 days of transactions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('bot_transactions')
        .select('*')
        .eq('bot_type', 'arbitrage')
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: true });
      
      if (error) {
        console.error('Error fetching transaction history:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        // If no data yet, use an empty chart
        setChartData([]);
        return;
      }
      
      // Process transactions into daily profit data
      const dailyProfits = new Map<string, number>();
      
      data.forEach(tx => {
        const date = format(new Date(tx.timestamp || new Date()), 'yyyy-MM-dd');
        const profit = typeof tx.profit === 'string' ? parseFloat(tx.profit || '0') : (tx.profit || 0);
        const gas = typeof tx.gas === 'string' ? parseFloat(tx.gas || '0') : (tx.gas || 0);
        
        if (dailyProfits.has(date)) {
          dailyProfits.set(date, dailyProfits.get(date)! + profit - gas);
        } else {
          dailyProfits.set(date, profit - gas);
        }
      });
      
      // Fill in missing dates (days with no transactions)
      const filledData = [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(today.getDate() - (29 - i));
        const dateStr = format(date, 'yyyy-MM-dd');
        
        filledData.push({
          date: dateStr,
          profit: dailyProfits.get(dateStr) || 0
        });
      }
      
      setChartData(filledData);
    };
    
    fetchTransactionHistory();
    
    // Set up real-time listener for new transactions
    const channel = supabase
      .channel('arbitrage-chart-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions', filter: 'bot_type=eq.arbitrage' },
          (payload) => {
            // When a new transaction comes in, refresh the chart
            fetchTransactionHistory();
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  const formattedStats = {
    netProfit: stats.totalProfit - (stats.gasSpent || 0),
    transactions: stats.totalTxs,
    successRate: stats.successRate,
    avgProfit: stats.avgProfit,
    gasSpent: stats.gasSpent || 0
  };
  
  const profitColor = formattedStats.netProfit >= 0 ? '#00E676' : '#FF5252';
  
  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <CircleDollarSign className="mr-2" /> Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="date" 
                hide={false}
                tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                tickMargin={5}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a2e', 
                  border: '1px solid #00E676',
                  borderRadius: '4px'
                }}
                labelStyle={{ color: '#00E676' }}
                itemStyle={{ color: '#00E676' }}
                formatter={(value: number) => [`${value.toFixed(5)} ETH`, 'Profit']}
                labelFormatter={(value) => `Date: ${format(new Date(value), 'MMM dd, yyyy')}`}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#00E676" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-crypto-darker p-4 rounded-md">
            <div className="text-xs text-muted-foreground">Net Profit</div>
            <div className="mt-1 text-lg font-bold" style={{ color: profitColor }}>
              {formattedStats.netProfit.toFixed(5)} ETH
            </div>
          </div>
          
          <div className="bg-crypto-darker p-4 rounded-md">
            <div className="text-xs text-muted-foreground">Gas Spent</div>
            <div className="mt-1 text-lg font-bold text-orange-400">
              {formattedStats.gasSpent.toFixed(5)} ETH
            </div>
          </div>
          
          <div className="bg-crypto-darker p-4 rounded-md">
            <div className="text-xs text-muted-foreground">Success Rate</div>
            <div className="mt-1 text-lg font-bold text-neon-blue">
              {formattedStats.successRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-crypto-darker p-4 rounded-md">
            <div className="text-xs text-muted-foreground">Avg Profit/Trade</div>
            <div className="mt-1 text-lg font-bold text-neon-pink">
              {formattedStats.avgProfit.toFixed(5)} ETH
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BotPerformance;
