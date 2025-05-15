
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, ArrowDownRight, Info, Target } from "lucide-react";

const StatsOverview = () => {
  const stats = [
    {
      title: "Total Profit",
      value: "42.87 ETH",
      change: "+12.5%",
      positive: true,
      icon: <Target className="h-4 w-4 text-neon-green" />,
      color: "neon-green"
    },
    {
      title: "Transactions",
      value: "1,286",
      change: "+8.2%",
      positive: true,
      icon: <ArrowUpRight className="h-4 w-4 text-neon-blue" />,
      color: "neon-blue"
    },
    {
      title: "Gas Spent",
      value: "6.32 ETH",
      change: "-3.1%",
      positive: false,
      icon: <ArrowDownRight className="h-4 w-4 text-neon-pink" />,
      color: "neon-pink"
    },
    {
      title: "Success Rate",
      value: "96.8%",
      change: "+1.2%",
      positive: true,
      icon: <Target className="h-4 w-4 text-neon-blue" />,
      color: "neon-blue"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-crypto-card border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              {stat.title}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{`Information about ${stat.title.toLowerCase()}`}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            {stat.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: `var(--tw-color-${stat.color.replace('neon-', '')})` }}>
              {stat.value}
            </div>
            <p className={`text-xs inline-flex items-center ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
              {stat.positive ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {stat.change} <span className="text-muted-foreground ml-1">vs last week</span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsOverview;
