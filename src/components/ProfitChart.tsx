
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Generate sample profit data for the chart
const generateProfitData = () => {
  const result = [];
  let baseValue = 0.5;
  
  for (let i = 0; i < 24; i++) {
    // Create some random variations
    const randomChange = (Math.random() - 0.5) * 0.4;
    baseValue = Math.max(0.1, baseValue + randomChange);
    
    result.push({
      hour: i,
      profit: parseFloat(baseValue.toFixed(3)),
      gas: parseFloat((baseValue * 0.3).toFixed(3)),
      net: parseFloat((baseValue * 0.7).toFixed(3)),
    });
  }
  
  return result;
};

const ProfitChart = () => {
  const [timeframe, setTimeframe] = React.useState("24h");
  const [data] = React.useState(generateProfitData());

  const formatXAxis = (hour: number) => {
    return `${hour}:00`;
  };

  const formatYAxis = (value: number) => {
    return `${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-crypto-darker p-3 border border-gray-800 rounded-lg shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{`${formatXAxis(payload[0].payload.hour)}`}</p>
          <p className="text-xs">
            <span className="text-muted-foreground">Profit: </span>
            <span className="text-neon-green font-medium">{payload[0].value} ETH</span>
          </p>
          <p className="text-xs">
            <span className="text-muted-foreground">Gas: </span>
            <span className="text-neon-pink font-medium">{payload[1].value} ETH</span>
          </p>
          <p className="text-xs">
            <span className="text-muted-foreground">Net: </span>
            <span className="text-neon-blue font-medium">{payload[2].value} ETH</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-crypto-card border-none shadow-lg">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold crypto-gradient">Profit Analytics</CardTitle>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[100px] h-8 bg-crypto-darker">
            <SelectValue placeholder="24h" />
          </SelectTrigger>
          <SelectContent className="bg-crypto-darker border-gray-800">
            <SelectItem value="6h">6 hours</SelectItem>
            <SelectItem value="24h">24 hours</SelectItem>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff9d" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff00e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff00e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00f2ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="rgba(255,255,255,0.1)" 
              />
              <XAxis 
                dataKey="hour" 
                tickFormatter={formatXAxis} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatYAxis} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="profit" 
                stroke="#00ff9d" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorProfit)" 
              />
              <Area 
                type="monotone" 
                dataKey="gas" 
                stroke="#ff00e5" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorGas)" 
              />
              <Area 
                type="monotone" 
                dataKey="net" 
                stroke="#00f2ff" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorNet)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitChart;
