
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, ArrowRight, AlertTriangle } from "lucide-react";

// Mock transaction data
const generateMockTransaction = () => {
  const types = ['Arbitrage', 'Sandwich', 'Frontrun', 'Liquidation'];
  const statuses = ['success', 'pending', 'failed'];
  const tokens = ['ETH', 'USDC', 'WBTC', 'UNI', 'LINK'];
  const dexes = ['Uniswap', 'SushiSwap', 'Curve', '1inch', 'Balancer'];
  
  const type = types[Math.floor(Math.random() * types.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const profit = status === 'failed' ? 0 : (Math.random() * 0.5).toFixed(4);
  const gas = (Math.random() * 0.08).toFixed(4);
  const fromToken = tokens[Math.floor(Math.random() * tokens.length)];
  const toToken = tokens[Math.floor(Math.random() * tokens.length)];
  const platform = dexes[Math.floor(Math.random() * dexes.length)];
  
  return {
    id: `0x${Math.random().toString(16).slice(2, 10)}`,
    type,
    status,
    profit: Number(profit),
    gas: Number(gas),
    net: (Number(profit) - Number(gas)).toFixed(4),
    fromToken,
    toToken,
    platform,
    timestamp: new Date().toISOString()
  };
};

const TransactionMonitor = () => {
  const [transactions, setTransactions] = useState<Array<any>>([]);
  
  useEffect(() => {
    // Initial transactions
    setTransactions(Array(6).fill(null).map(generateMockTransaction));
    
    // Add new transaction every few seconds
    const interval = setInterval(() => {
      setTransactions(prev => {
        const newTx = generateMockTransaction();
        return [newTx, ...prev].slice(0, 50); // Keep max 50 transactions
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Arbitrage':
        return 'text-neon-blue';
      case 'Sandwich':
        return 'text-neon-pink';
      case 'Frontrun':
        return 'text-neon-green';
      case 'Liquidation':
        return 'text-orange-500';
      default:
        return 'text-white';
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-2 bg-crypto-card border-none shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center">
          <span className="crypto-gradient">Live Transactions</span>
          <div className="h-2 w-2 rounded-full bg-neon-green ml-2 animate-pulse-glow"></div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] rounded-md">
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-3 bg-crypto-darker rounded-lg border border-gray-800 data-flow-line">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold ${getTypeColor(tx.type)}`}>{tx.type}</span>
                    <span className="text-gray-500 text-xs font-mono">{tx.id}</span>
                  </div>
                  <div className="flex items-center">
                    {getStatusIcon(tx.status)}
                    <span className={`text-xs ml-1 ${
                      tx.status === 'success' ? 'text-green-500' :
                      tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm">
                    <span className="text-muted-foreground">{tx.platform}</span>
                    <span className="mx-2 text-xs text-gray-500">•</span>
                    <span className="text-white font-mono">{tx.fromToken}</span>
                    <ArrowRight className="h-3 w-3 mx-1 text-gray-500" />
                    <span className="text-white font-mono">{tx.toToken}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-gray-400">Gas: <span className="text-gray-300">{tx.gas} ETH</span></span>
                    <span className="text-gray-400">Profit: 
                      <span className={tx.profit > 0 ? 'text-green-500 ml-1' : 'text-red-500 ml-1'}>
                        {tx.profit} ETH
                      </span>
                    </span>
                    <span className="text-gray-400">Net: 
                      <span className={Number(tx.net) > 0 ? 'text-green-500 ml-1' : 'text-red-500 ml-1'}>
                        {tx.net} ETH
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TransactionMonitor;
