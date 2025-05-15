
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

// Mock exchanges and tokens
const DEXs = ["Uniswap", "SushiSwap", "Curve", "Balancer", "1inch"];
const tokens = ["ETH", "USDC", "WBTC", "UNI", "LINK", "AAVE", "SNX", "COMP"];

// Generate mock arbitrage opportunities
const generateArbitrageOpp = () => {
  const sourceIndex = Math.floor(Math.random() * DEXs.length);
  let targetIndex = Math.floor(Math.random() * DEXs.length);
  while (targetIndex === sourceIndex) {
    targetIndex = Math.floor(Math.random() * DEXs.length);
  }
  
  const tokenAIndex = Math.floor(Math.random() * tokens.length);
  let tokenBIndex = Math.floor(Math.random() * tokens.length);
  while (tokenBIndex === tokenAIndex) {
    tokenBIndex = Math.floor(Math.random() * tokens.length);
  }
  
  const profitPct = (Math.random() * 3 + 0.1).toFixed(2);
  const profitUsd = (Math.random() * 120 + 5).toFixed(2);
  const gasCost = (Math.random() * 20 + 5).toFixed(2);
  const netProfit = (parseFloat(profitUsd) - parseFloat(gasCost)).toFixed(2);
  
  return {
    id: `arb-${Math.random().toString(16).slice(2, 8)}`,
    source: DEXs[sourceIndex],
    target: DEXs[targetIndex],
    tokenA: tokens[tokenAIndex],
    tokenB: tokens[tokenBIndex],
    profitPct,
    profitUsd,
    gasCost,
    netProfit,
    timeRemaining: Math.floor(Math.random() * 30) + 5,
    confidence: Math.random() * 100
  };
};

const ArbitrageOpportunities = () => {
  const [opportunities, setOpportunities] = useState<Array<any>>([]);

  useEffect(() => {
    // Initialize with some opportunities
    setOpportunities(Array(4).fill(null).map(generateArbitrageOpp));
    
    // Update opportunities randomly
    const interval = setInterval(() => {
      setOpportunities(prev => {
        // Randomly decide if we're removing an opportunity
        if (Math.random() > 0.7 && prev.length > 0) {
          return [...prev.slice(0, -1)];
        }
        
        // Randomly decide if we're adding an opportunity
        if (Math.random() > 0.5 || prev.length < 2) {
          return [...prev, generateArbitrageOpp()].slice(0, 4);
        }
        
        return prev;
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 80) {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">High</Badge>;
    } else if (confidence > 50) {
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">Medium</Badge>;
    } else {
      return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">Low</Badge>;
    }
  };

  return (
    <Card className="col-span-1 bg-crypto-card border-none shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold crypto-gradient">Arbitrage Opportunities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.length > 0 ? (
            opportunities.map((opp) => (
              <div 
                key={opp.id} 
                className="p-3 bg-crypto-darker rounded-lg border border-gray-800 hover:border-neon-blue/30 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center">
                      <Badge className="bg-neon-blue/20 text-neon-blue border-neon-blue/50">
                        {opp.profitPct}% Profit
                      </Badge>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {opp.timeRemaining}s window
                      </span>
                    </div>
                    <div className="flex items-center mt-2">
                      <span className="text-muted-foreground text-sm">{opp.source}</span>
                      <ArrowRight className="mx-2 h-3 w-3 text-gray-500" />
                      <span className="text-muted-foreground text-sm">{opp.target}</span>
                    </div>
                  </div>
                  <div>
                    {getConfidenceBadge(opp.confidence)}
                  </div>
                </div>
                
                <div className="flex items-center text-sm mb-3">
                  <span className="text-white font-mono">{opp.tokenA}</span>
                  <ArrowRight className="h-3 w-3 mx-1 text-gray-500" />
                  <span className="text-white font-mono">{opp.tokenB}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="text-xs space-y-1">
                    <div className="text-gray-400">Est. Profit: <span className="text-green-500">${opp.profitUsd}</span></div>
                    <div className="text-gray-400">Gas Cost: <span className="text-gray-300">${opp.gasCost}</span></div>
                    <div className="text-gray-400">Net: <span className="text-green-500">${opp.netProfit}</span></div>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-neon-blue to-neon-green text-black">
                    <Zap className="h-3 w-3 mr-1" /> Execute
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex justify-center items-center py-8 text-muted-foreground">
              No arbitrage opportunities available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ArbitrageOpportunities;
