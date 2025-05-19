
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, subHours, subDays, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ChartDataPoint {
  hour: string;
  profit: number;
  gas: number;
  net: number;
}

const ProfitChart = () => {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState("24h");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfitData = async () => {
      try {
        setIsLoading(true);
        
        // Calculate the start time based on the selected timeframe
        const now = new Date();
        let startTime: Date;
        
        switch(timeframe) {
          case '6h':
            startTime = subHours(now, 6);
            break;
          case '24h':
            startTime = subHours(now, 24);
            break;
          case '7d':
            startTime = subDays(now, 7);
            break;
          case '30d':
            startTime = subDays(now, 30);
            break;
          default:
            startTime = subHours(now, 24);
        }
        
        // Fetch transaction data from the selected timeframe
        const { data: transactions, error } = await supabase
          .from('bot_transactions')
          .select('*')
          .gte('timestamp', startTime.toISOString())
          .order('timestamp', { ascending: true });
          
        if (error) throw error;
        
        if (transactions) {
          // Group transactions by hour/day (depending on timeframe)
          const groupedData = new Map<string, {profit: number, gas: number, net: number}>();
          
          // Determine format string based on timeframe
          let formatString = 'yyyy-MM-dd HH:00';
          if (timeframe === '7d' || timeframe === '30d') {
            formatString = 'yyyy-MM-dd';
          }
          
          // Process transactions
          transactions.forEach(tx => {
            const timestamp = typeof tx.timestamp === 'string' ? parseISO(tx.timestamp) : new Date();
            const timeKey = format(timestamp, formatString);
            
            const profit = typeof tx.profit === 'string' ? parseFloat(tx.profit || '0') : (tx.profit || 0);
            const gas = typeof tx.gas === 'string' ? parseFloat(tx.gas || '0') : (tx.gas || 0);
            
            if (groupedData.has(timeKey)) {
              const existing = groupedData.get(timeKey)!;
              groupedData.set(timeKey, {
                profit: existing.profit + profit,
                gas: existing.gas + gas,
                net: existing.net + profit - gas
              });
            } else {
              groupedData.set(timeKey, {
                profit: profit,
                gas: gas,
                net: profit - gas
              });
            }
          });
          
          // Fill in missing time periods with zeros
          let timeKeys: string[] = [];
          
          if (timeframe === '6h' || timeframe === '24h') {
            const hours = timeframe === '6h' ? 6 : 24;
            for (let i = 0; i < hours; i++) {
              const time = subHours(now, hours - i);
              timeKeys.push(format(time, formatString));
            }
          } else {
            const days = timeframe === '7d' ? 7 : 30;
            for (let i = 0; i < days; i++) {
              const time = subDays(now, days - i);
              timeKeys.push(format(time, formatString));
            }
          }
          
          // Generate final chart data with all time periods
          const processedChartData = timeKeys.map(key => {
            const data = groupedData.get(key) || { profit: 0, gas: 0, net: 0 };
            return {
              hour: key,
              profit: parseFloat(data.profit.toFixed(5)),
              gas: parseFloat(data.gas.toFixed(5)),
              net: parseFloat(data.net.toFixed(5))
            };
          });
          
          setChartData(processedChartData);
        }
      } catch (error) {
        console.error("Error fetching profit data:", error);
        toast({
          title: "Error loading chart data",
          description: "Could not fetch profit history",
          variant: "destructive"
        });
        
        // Use empty data if fetch fails
        setChartData([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfitData();
    
    // Set up real-time listener for profit updates
    const channel = supabase
      .channel('profit-chart-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions' },
          () => {
            fetchProfitData();
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [timeframe, toast]);

  const formatXAxis = (time: string) => {
    if (!time) return '';
    
    try {
      const date = parseISO(time);
      
      if (timeframe === '6h' || timeframe === '24h') {
        return format(date, 'HH:00');
      } else {
        return format(date, 'MM/dd');
      }
    } catch (e) {
      return time;
    }
  };

  const formatYAxis = (value: number) => {
    return `${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-crypto-darker p-3 border border-gray-800 rounded-lg shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{`${payload[0].payload.hour}`}</p>
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
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-muted-foreground animate-pulse">Loading profit data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-muted-foreground">No profit data available for the selected timeframe</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitChart;
