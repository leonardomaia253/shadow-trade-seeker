
import React from 'react';
import { AlertTriangle, Check, Clock, Play, Power, Settings } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TokenInfo } from "@/Arbitrum/utils/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BotModuleStatus {
  [key: string]: string;
}

interface GenericBotControlPanelProps {
  botType: string;
  isRunning: boolean;
  isStarting?: boolean;
  isStopping?: boolean;
  onStart: () => void;
  onStop: () => void;
  stats: {
    totalProfit: number;
    successRate: number;
    avgProfit: number;
    totalTxs: number;
    gasSpent: number;
  };
  baseToken: TokenInfo;
  profitThreshold: number;
  moduleStatus?: BotModuleStatus;
  lastUpdate?: string | null;
}

const GenericBotControlPanel: React.FC<GenericBotControlPanelProps> = ({
  botType,
  isRunning,
  isStarting = false,
  isStopping = false,
  onStart,
  onStop,
  stats,
  baseToken,
  profitThreshold,
  moduleStatus = {},
  lastUpdate
}) => {
  const formatEth = (value: number) => {
    return `${value.toFixed(6)} ${baseToken.symbol}`;
  };

  const getStatusBadge = () => {
    if (isStarting) {
      return <Badge variant="outline" className="bg-yellow-500 border-yellow-400 text-white">Starting...</Badge>;
    }
    if (isStopping) {
      return <Badge variant="outline" className="bg-yellow-500 border-yellow-400 text-white">Stopping...</Badge>;
    }
    return isRunning ? (
      <Badge variant="outline" className="bg-green-500 border-green-400 text-white">Running</Badge>
    ) : (
      <Badge variant="outline" className="bg-red-500 border-red-400 text-white">Stopped</Badge>
    );
  };

  const getModuleStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Check className="h-4 w-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'inactive':
      default:
        return <Power className="h-4 w-4 text-gray-400" />;
    }
  };

  const getModuleStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return "text-green-400";
      case 'warning':
        return "text-yellow-400";
      case 'error':
        return "text-red-500";
      case 'inactive':
      default:
        return "text-gray-400";
    }
  };

  return (
    <Card className="bg-crypto-card border-crypto-border shadow-glow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-crypto-border">
        <CardTitle className="text-xl">{botType.charAt(0).toUpperCase() + botType.slice(1)} Bot Status</CardTitle>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Tooltip>
            <TooltipTrigger>
              <Clock className="h-4 w-4 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Last Updated: {lastUpdate || 'N/A'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="status">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Module Status</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.keys(moduleStatus).length > 0 ? (
                  Object.entries(moduleStatus).map(([module, status]) => (
                    <div key={module} className="p-2 border rounded border-crypto-border flex items-center gap-2">
                      {getModuleStatusIcon(status)}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{module}</span>
                        <span className={`text-xs ${getModuleStatusColor(status)}`}>{status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-sm text-gray-400">No module status available</div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Performance</h3>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="py-1.5 text-sm font-medium">Total Profit</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{formatEth(stats.totalProfit)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1.5 text-sm font-medium">Success Rate</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{stats.successRate}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1.5 text-sm font-medium">Average Profit</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{formatEth(stats.avgProfit)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1.5 text-sm font-medium">Total Transactions</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{stats.totalTxs}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1.5 text-sm font-medium">Gas Spent</TableCell>
                    <TableCell className="py-1.5 text-sm text-right">{formatEth(stats.gasSpent)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="config">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="py-1.5 text-sm font-medium">Base Token</TableCell>
                  <TableCell className="py-1.5 text-sm text-right">{baseToken.symbol}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-1.5 text-sm font-medium">Min Profit Threshold</TableCell>
                  <TableCell className="py-1.5 text-sm text-right">{profitThreshold} {baseToken.symbol}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-1.5 text-sm font-medium">Gas Multiplier</TableCell>
                  <TableCell className="py-1.5 text-sm text-right">1.2x</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-1.5 text-sm font-medium">Slippage Tolerance</TableCell>
                  <TableCell className="py-1.5 text-sm text-right">0.5%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="py-1.5 text-sm font-medium">Target DEXs</TableCell>
                  <TableCell className="py-1.5 text-sm text-right">Uniswap, SushiSwap</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between pt-2 border-t border-crypto-border">
        <Button 
          variant="outline" 
          className="border-gray-600 text-gray-300"
          size="sm"
          onClick={onStart} 
          disabled={isRunning || isStarting || isStopping}
        >
          {isStarting ? (
            <>
              <span className="animate-pulse mr-2">•</span>Starting...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Start Bot
            </>
          )}
        </Button>
        <Button 
          variant="outline" 
          className="border-gray-600 text-gray-300"
          size="sm"
          onClick={onStop}
          disabled={!isRunning || isStarting || isStopping}
        >
          {isStopping ? (
            <>
              <span className="animate-pulse mr-2">•</span>Stopping...
            </>
          ) : (
            <>
              <Power className="mr-2 h-4 w-4" /> Stop Bot
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GenericBotControlPanel;
