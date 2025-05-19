
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  bot_type: string;
  timestamp: string;
  profit: number;
  action: string;
  protocol?: string;
}

const ArbitrageOpportunities = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchRecentArbitrageOpportunities = async () => {
      try {
        setIsLoading(true);
        
        // Get the most profitable recent transactions
        const { data, error } = await supabase
          .from('bot_transactions')
          .select('*')
          .in('bot_type', ['arbitrage', 'profiter-one', 'profiter-two'])
          .order('profit', { ascending: false })
          .limit(5);

        if (error) throw error;
        
        if (data) {
          setOpportunities(data.map(tx => ({
            id: tx.id,
            bot_type: tx.bot_type,
            timestamp: tx.timestamp || new Date().toISOString(),
            profit: typeof tx.profit === 'string' ? parseFloat(tx.profit) : (tx.profit || 0),
            action: tx.action || 'swap',
            protocol: tx.protocol
          })));
        }
      } catch (error) {
        console.error("Error fetching arbitrage opportunities:", error);
        toast({
          title: "Error loading opportunities",
          description: "Failed to fetch recent arbitrage opportunities",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecentArbitrageOpportunities();
    
    // Set up real-time listener for new transactions
    const channel = supabase
      .channel('arbitrage-opportunities-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions' },
          () => {
            fetchRecentArbitrageOpportunities();
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Format the profit as ETH with limited decimal places
  const formatProfit = (profit: number) => {
    return `${profit.toFixed(6)} ETH`;
  };

  // Format the timestamp into a readable format
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  // Get display information for a bot type
  const getBotInfo = (botType: string) => {
    switch(botType) {
      case 'arbitrage':
        return { color: 'text-green-400', name: 'Arbitrage' };
      case 'profiter-one':
        return { color: 'text-blue-400', name: 'Profiter 1' };
      case 'profiter-two':
        return { color: 'text-pink-400', name: 'Profiter 2' };
      default:
        return { color: 'text-gray-400', name: botType };
    }
  };

  return (
    <Card className="col-span-1 bg-crypto-card border-none shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg crypto-gradient">Recent Arbitrage Opportunities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground animate-pulse">
            Loading opportunities...
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent arbitrage opportunities found.
          </div>
        ) : (
          opportunities.map((opp) => {
            const botInfo = getBotInfo(opp.bot_type);
            
            return (
              <div key={opp.id} className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-0">
                <div>
                  <div className="flex items-center">
                    <span className={`text-xs ${botInfo.color} mr-2`}>{botInfo.name}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(opp.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <div className="flex items-center">
                      {opp.action} {opp.protocol ? `on ${opp.protocol}` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-neon-green font-mono font-medium">
                    +{formatProfit(opp.profit)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default ArbitrageOpportunities;
