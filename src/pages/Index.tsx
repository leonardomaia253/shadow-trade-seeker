
import React from 'react';
import { Link } from 'react-router-dom';
import DashboardHeader from '@/components/DashboardHeader';
import StatsOverview from '@/components/StatsOverview';
import TransactionMonitor from '@/components/TransactionMonitor';
import ArbitrageOpportunities from '@/components/ArbitrageOpportunities';
import SandwichSimulator from '@/components/SandwichSimulator';
import ProfitChart from '@/components/ProfitChart';
import { Button } from '@/components/ui/button';
import { Settings, Bot } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-crypto-darker text-foreground font-mono">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold crypto-gradient">Dashboard Overview</h1>
          
          <div className="flex gap-3">
            <Link to="/arbitrage">
              <Button className="bg-gradient-to-r from-neon-blue to-neon-pink text-black font-semibold">
                <Bot className="mr-2 h-4 w-4" /> Control Arbitrage Bot
              </Button>
            </Link>
            
            <Link to="/arbitrage">
              <Button className="bg-gradient-to-r from-neon-blue to-neon-pink text-black font-semibold">
                <Settings className="mr-2 h-4 w-4" /> Manage Arbitrage Bot
              </Button>
            </Link>
          </div>
        </div>
        
        <StatsOverview />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <TransactionMonitor />
          <ArbitrageOpportunities />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SandwichSimulator />
          <ProfitChart />
        </div>
      </div>
    </div>
  );
};

export default Index;
