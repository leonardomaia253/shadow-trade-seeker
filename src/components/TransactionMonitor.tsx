
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  bot_type: string;
  timestamp: string;
  status: string;
  action: string;
  profit?: number;
  gas?: number;
  tx_hash?: string;
}

const TransactionMonitor = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchRecentTransactions = async () => {
      try {
        setIsLoading(true);
        
        // Get most recent transactions across all bot types
        const { data, error } = await supabase
          .from('bot_transactions')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);
          
        if (error) throw error;
        
        if (data) {
          setTransactions(data.map(tx => ({
            id: tx.id,
            bot_type: tx.bot_type,
            timestamp: tx.timestamp || new Date().toISOString(),
            status: tx.status || 'unknown',
            action: tx.action || 'transaction',
            profit: typeof tx.profit === 'string' ? parseFloat(tx.profit) : tx.profit,
            gas: typeof tx.gas === 'string' ? parseFloat(tx.gas) : tx.gas,
            tx_hash: tx.tx_hash
          })));
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast({
          title: "Error loading transactions",
          description: "Failed to fetch recent transactions",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecentTransactions();
    
    // Set up real-time listener for new transactions
    const channel = supabase
      .channel('transaction-monitor-updates')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'bot_transactions' },
          (payload) => {
            const newTx = payload.new as any;
            setTransactions(prev => [
              {
                id: newTx.id,
                bot_type: newTx.bot_type,
                timestamp: newTx.timestamp || new Date().toISOString(),
                status: newTx.status || 'unknown',
                action: newTx.action || 'transaction',
                profit: typeof newTx.profit === 'string' ? parseFloat(newTx.profit) : newTx.profit,
                gas: typeof newTx.gas === 'string' ? parseFloat(newTx.gas) : newTx.gas,
                tx_hash: newTx.tx_hash
              },
              ...prev.slice(0, 9)
            ]);
          })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

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

  // Get display information based on transaction status
  const getStatusInfo = (status: string) => {
    switch(status.toLowerCase()) {
      case 'success':
        return { color: 'bg-green-500', text: 'Success' };
      case 'pending':
        return { color: 'bg-yellow-500', text: 'Pending' };
      case 'failed':
        return { color: 'bg-red-500', text: 'Failed' };
      default:
        return { color: 'bg-gray-500', text: status };
    }
  };

  // Get bot name from bot_type
  const getBotName = (botType: string) => {
    switch(botType) {
      case 'arbitrage':
        return 'Arbitrage';
      case 'liquidation':
        return 'Liquidation';
      case 'profiter-one':
        return 'Profiter 1';
      case 'profiter-two':
        return 'Profiter 2';
      case 'sandwich':
        return 'Sandwich';
      case 'frontrun':
        return 'Frontrun';
      default:
        return botType;
    }
  };

  // Format transaction hash for display
  const formatTxHash = (hash?: string) => {
    if (!hash) return '';
    
    // Handle both string hashes and JSON-stringified arrays of hashes
    try {
      const parsed = JSON.parse(hash);
      if (Array.isArray(parsed)) {
        const singleHash = parsed[0];
        if (typeof singleHash === 'object' && singleHash.to) {
          return `${singleHash.to.substring(0, 6)}...${singleHash.to.substring(singleHash.to.length - 4)}`;
        } else if (typeof singleHash === 'string') {
          return `${singleHash.substring(0, 6)}...${singleHash.substring(singleHash.length - 4)}`;
        }
      }
      return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
    } catch {
      // If hash is just a plain string
      return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
    }
  };

  return (
    <Card className="col-span-2 lg:col-span-2 bg-crypto-card border-none shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg crypto-gradient">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left pb-2">Time</th>
                <th className="text-left pb-2">Bot</th>
                <th className="text-left pb-2">Action</th>
                <th className="text-left pb-2">Tx Hash</th>
                <th className="text-right pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground animate-pulse">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    No recent transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const statusInfo = getStatusInfo(tx.status);
                  
                  return (
                    <tr key={tx.id} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {formatTimestamp(tx.timestamp)}
                      </td>
                      <td className="py-2">
                        {getBotName(tx.bot_type)}
                      </td>
                      <td className="py-2 capitalize">
                        {tx.action}
                      </td>
                      <td className="py-2 font-mono text-xs">
                        {formatTxHash(tx.tx_hash)}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color} text-white`}>
                          {statusInfo.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionMonitor;
