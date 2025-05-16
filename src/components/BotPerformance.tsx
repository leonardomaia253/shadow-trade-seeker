
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CircleDollarSign } from 'lucide-react';

interface BotPerformanceProps {
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent?: number;
  };
}

// This would normally be fetched from the database
const generateMockData = () => {
  const data = [];
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    
    data.push({
      date: date.toLocaleDateString(),
      profit: Math.random() * 0.1, // Random profit between 0 and 0.1 ETH
    });
  }
  
  return data;
};

const BotPerformance = ({ stats }: BotPerformanceProps) => {
  const data = generateMockData();
  
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
            <LineChart data={data}>
              <XAxis dataKey="date" hide />
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
                labelFormatter={(value) => `Date: ${value}`}
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
