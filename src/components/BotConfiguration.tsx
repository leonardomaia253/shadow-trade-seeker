
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { TokenInfo } from '@/Arbitrum/utils/types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDexList } from "@/Arbitrum/utils/dexList";

interface BotConfigurationProps {
  baseToken: TokenInfo;
  profitThreshold: number;
  onUpdateConfig: (config: any) => void;
}

const tokenOptions = [
  { address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", symbol: "WETH", decimals: 18 },
  { address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", symbol: "WBTC", decimals: 8 },
  { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
  { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol: "USDC", decimals: 6 },
  { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
];

const BotConfiguration = ({ baseToken, profitThreshold, onUpdateConfig }: BotConfigurationProps) => {
  const [localBaseToken, setLocalBaseToken] = useState<TokenInfo>(baseToken);
  const [localProfitThreshold, setLocalProfitThreshold] = useState<number>(profitThreshold);
  const [dexList, setDexList] = useState<string[]>([]);
  
  // Fetch DEX list when component mounts
  React.useEffect(() => {
    const fetchDexes = async () => {
      try {
        const dexes = await getDexList();
        setDexList(dexes);
      } catch (error) {
        console.error("Failed to fetch DEX list:", error);
      }
    };
    
    fetchDexes();
  }, []);

  const handleSaveConfig = () => {
    onUpdateConfig({
      baseToken: localBaseToken,
      profitThreshold: localProfitThreshold
    });
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-neon-blue flex items-center">
          <Settings className="mr-2" /> Bot Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseToken">Base Token</Label>
            <Select 
              value={localBaseToken.address} 
              onValueChange={(value) => {
                const token = tokenOptions.find(t => t.address === value);
                if (token) setLocalBaseToken(token);
              }}
            >
              <SelectTrigger className="bg-crypto-darker border-crypto-border">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="bg-crypto-darker border-crypto-border">
                {tokenOptions.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="profitThreshold">Profit Threshold (ETH)</Label>
            <Input 
              id="profitThreshold"
              type="number" 
              step="0.0001"
              min="0"
              value={localProfitThreshold}
              onChange={(e) => setLocalProfitThreshold(parseFloat(e.target.value))}
              className="bg-crypto-darker border-crypto-border"
            />
            <p className="text-xs text-muted-foreground">
              Minimum profit required to execute arbitrage
            </p>
          </div>
          
          <div className="space-y-2 mt-4">
            <Label>Monitored DEXes ({dexList.length})</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dexList.slice(0, 6).map((dex, index) => (
                <div key={index} className="bg-crypto-darker p-2 rounded flex items-center">
                  <div className="h-2 w-2 rounded-full bg-neon-blue mr-2"></div>
                  {`0x...${dex.slice(-4)}`}
                </div>
              ))}
              {dexList.length > 6 && (
                <div className="bg-crypto-darker p-2 rounded flex items-center">
                  <div className="h-2 w-2 rounded-full bg-neon-blue mr-2"></div>
                  {`+${dexList.length - 6} more`}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSaveConfig}
          className="w-full mt-4 bg-neon-blue hover:bg-neon-blue/80"
        >
          Save Configuration
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BotConfiguration;
