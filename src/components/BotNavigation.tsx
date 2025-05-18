
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Bot, TrendingUp, ShoppingCart, Zap, Database } from 'lucide-react';

const BotNavigation = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Link to="/arbitrage">
        <Button 
          variant={isActive('/arbitrage') ? "default" : "outline"} 
          className={`flex items-center ${isActive('/arbitrage') ? 'bg-neon-blue text-black' : ''}`}
        >
          <Bot className="mr-2 h-4 w-4" /> Arbitrage Bot
        </Button>
      </Link>
      
      <Link to="/profiter-one">
        <Button 
          variant={isActive('/profiter-one') ? "default" : "outline"}
          className={`flex items-center ${isActive('/profiter-one') ? 'bg-neon-green text-black' : ''}`}
        >
          <TrendingUp className="mr-2 h-4 w-4" /> Profiter One
        </Button>
      </Link>
      
      <Link to="/profiter-two">
        <Button 
          variant={isActive('/profiter-two') ? "default" : "outline"}
          className={`flex items-center ${isActive('/profiter-two') ? 'bg-neon-pink text-black' : ''}`}
        >
          <TrendingUp className="mr-2 h-4 w-4" /> Profiter Two
        </Button>
      </Link>
      
      <Link to="/liquidation">
        <Button 
          variant={isActive('/liquidation') ? "default" : "outline"}
          className={`flex items-center ${isActive('/liquidation') ? 'bg-neon-purple text-black' : ''}`}
        >
          <Database className="mr-2 h-4 w-4" /> Liquidation Bot
        </Button>
      </Link>
      
      <Link to="/frontrun">
        <Button 
          variant={isActive('/frontrun') ? "default" : "outline"}
          className={`flex items-center ${isActive('/frontrun') ? 'bg-neon-yellow text-black' : ''}`}
        >
          <Zap className="mr-2 h-4 w-4" /> Frontrun Bot
        </Button>
      </Link>
      
      <Link to="/sandwich">
        <Button 
          variant={isActive('/sandwich') ? "default" : "outline"}
          className={`flex items-center ${isActive('/sandwich') ? 'bg-neon-orange text-black' : ''}`}
        >
          <ShoppingCart className="mr-2 h-4 w-4" /> Sandwich Bot
        </Button>
      </Link>
    </div>
  );
};

export default BotNavigation;
