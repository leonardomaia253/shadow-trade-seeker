
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowBigUpDash, ArrowBigDownDash, Banknote, BarChartHorizontal, FlaskRound, FlaskConical } from "lucide-react";

const BotNavigation = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
      <Link 
        to="/arbitrage" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/arbitrage') ? 'bg-crypto-darker text-neon-blue' : 'bg-crypto-card text-neon-blue hover:bg-crypto-darker'}`}
      >
        <ArrowBigUpDash className="mr-2 h-4 w-4" />
        Arbitrage Bot
      </Link>
      <Link 
        to="/profiter-one" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/profiter-one') ? 'bg-crypto-darker text-neon-green' : 'bg-crypto-card text-neon-green hover:bg-crypto-darker'}`}
      >
        <Banknote className="mr-2 h-4 w-4" />
        Profiter One Bot
      </Link>
      <Link 
        to="/profiter-two" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/profiter-two') ? 'bg-crypto-darker text-neon-pink' : 'bg-crypto-card text-neon-pink hover:bg-crypto-darker'}`}
      >
        <BarChartHorizontal className="mr-2 h-4 w-4" />
        Profiter Two Bot
      </Link>
      <Link 
        to="/liquidation" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/liquidation') ? 'bg-crypto-darker text-neon-purple' : 'bg-crypto-card text-neon-purple hover:bg-crypto-darker'}`}
      >
        <ArrowBigDownDash className="mr-2 h-4 w-4" />
        Liquidation Bot
      </Link>
      <Link 
        to="/frontrun" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/frontrun') ? 'bg-crypto-darker text-neon-yellow' : 'bg-crypto-card text-neon-yellow hover:bg-crypto-darker'}`}
      >
        <FlaskRound className="mr-2 h-4 w-4" />
        Frontrun Bot
      </Link>
      <Link 
        to="/sandwich" 
        className={`flex items-center px-4 py-2 border-crypto-border rounded-md transition-colors ${isActive('/sandwich') ? 'bg-crypto-darker text-neon-orange' : 'bg-crypto-card text-neon-orange hover:bg-crypto-darker'}`}
      >
        <FlaskConical className="mr-2 h-4 w-4" />
        Sandwich Bot
      </Link>
    </div>
  );
};

export default BotNavigation;
