
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Laptop, Zap, BarChart3, Clock, Settings } from "lucide-react";

const DashboardHeader = () => {
  return (
    <header className="flex items-center justify-between w-full p-4">
      <div className="flex items-center gap-3">
        <Zap className="h-8 w-8 text-neon-blue" />
        <h1 className="text-2xl font-bold crypto-gradient">MEV<span className="ml-1 text-xl">Vision</span></h1>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-auto">
        <TabsList className="bg-crypto-card">
          <TabsTrigger value="dashboard" className="data-tab">
            <Laptop className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="arbitrage" className="data-tab">
            <BarChart3 className="h-4 w-4 mr-2" />
            Arbitrage
          </TabsTrigger>
          <TabsTrigger value="history" className="data-tab">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-tab">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="flex items-center gap-2">
        <div className="px-3 py-1 bg-crypto-card rounded-full text-neon-green text-sm font-mono flex items-center">
          <span className="h-2 w-2 rounded-full bg-neon-green mr-2 animate-pulse-glow"></span>
          <span>ACTIVE</span>
        </div>
        <button className="bg-gradient-to-r from-neon-blue to-neon-pink text-black font-semibold px-4 py-1.5 rounded-md text-sm">
          Connect Wallet
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader;
