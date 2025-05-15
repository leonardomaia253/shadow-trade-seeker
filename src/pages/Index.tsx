
import React from 'react';
import DashboardHeader from '@/components/DashboardHeader';
import StatsOverview from '@/components/StatsOverview';
import TransactionMonitor from '@/components/TransactionMonitor';
import ArbitrageOpportunities from '@/components/ArbitrageOpportunities';
import SandwichSimulator from '@/components/SandwichSimulator';
import ProfitChart from '@/components/ProfitChart';

const Index = () => {
  return (
    <div className="min-h-screen bg-crypto-darker text-foreground font-mono">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-6">
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
