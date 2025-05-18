
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowBigUpDash, ArrowBigDownDash, Banknote, BarChartHorizontal, FlaskRound, FlaskConical } from "lucide-react";

const BotNavigation = () => {
  return (
    <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
      <Link 
        to="/arbitrage" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-blue hover:bg-crypto-darker transition-colors"
      >
        <ArrowBigUpDash className="mr-2 h-4 w-4" />
        Arbitrage Bot
      </Link>
      <Link 
        to="/profiter-one" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-green hover:bg-crypto-darker transition-colors"
      >
        <Banknote className="mr-2 h-4 w-4" />
        Profiter One Bot
      </Link>
      <Link 
        to="/profiter-two" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-pink hover:bg-crypto-darker transition-colors"
      >
        <BarChartHorizontal className="mr-2 h-4 w-4" />
        Profiter Two Bot
      </Link>
      <Link 
        to="/liquidation" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-purple hover:bg-crypto-darker transition-colors"
      >
        <ArrowBigDownDash className="mr-2 h-4 w-4" />
        Liquidation Bot
      </Link>
      <Link 
        to="/frontrun" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-yellow hover:bg-crypto-darker transition-colors"
      >
        <FlaskRound className="mr-2 h-4 w-4" />
        Frontrun Bot
      </Link>
      <Link 
        to="/sandwich" 
        className="flex items-center px-4 py-2 bg-crypto-card border-crypto-border rounded-md text-neon-orange hover:bg-crypto-darker transition-colors"
      >
        <FlaskConical className="mr-2 h-4 w-4" />
        Sandwich Bot
      </Link>
    </div>
  );
};

export default BotNavigation;
