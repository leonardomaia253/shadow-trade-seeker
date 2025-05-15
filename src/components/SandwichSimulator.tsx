
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PlayCircle, PauseCircle, RefreshCcw } from "lucide-react";

const SandwichSimulator = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [slippage, setSlippage] = useState(0.5);
  const [gasPrice, setGasPrice] = useState(40);
  const [targetSize, setTargetSize] = useState(1000);
  const [profitEstimate, setProfitEstimate] = useState("0.00");
  const [extractableValue, setExtractableValue] = useState("0.00");
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + simulationSpeed;
          if (newProgress >= 100) {
            setIsRunning(false);
            calculateResults();
            return 100;
          }
          return newProgress;
        });
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, simulationSpeed]);
  
  useEffect(() => {
    // Update value estimates when parameters change
    if (!isRunning) {
      calculateResults();
    }
  }, [slippage, gasPrice, targetSize]);
  
  const calculateResults = () => {
    // Mock formula for sandwich attack profitability
    const baseProfit = (targetSize * slippage / 100) * (1 - (gasPrice / 200));
    const randomFactor = 0.8 + Math.random() * 0.4; // Add some randomness
    
    setProfitEstimate((baseProfit * randomFactor).toFixed(4));
    setExtractableValue((baseProfit * randomFactor * 1.2).toFixed(4));
  };
  
  const startSimulation = () => {
    setIsRunning(true);
    setProgress(0);
  };
  
  const pauseSimulation = () => {
    setIsRunning(false);
  };
  
  const resetSimulation = () => {
    setIsRunning(false);
    setProgress(0);
    calculateResults();
  };

  return (
    <Card className="col-span-1 bg-crypto-card border-none shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold crypto-gradient">Sandwich Attack Simulator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-muted-foreground">Simulation Progress</Label>
              <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2 w-full" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Target Tx Size (USD)</Label>
              <Input 
                type="number" 
                value={targetSize}
                onChange={(e) => setTargetSize(Number(e.target.value))}
                className="bg-crypto-darker border-gray-800"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Gas Price (gwei)</Label>
              <Input 
                type="number" 
                value={gasPrice}
                onChange={(e) => setGasPrice(Number(e.target.value))}
                className="bg-crypto-darker border-gray-800"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-muted-foreground">Slippage Impact (%)</Label>
              <span className="text-sm text-foreground">{slippage.toFixed(2)}%</span>
            </div>
            <Slider 
              value={[slippage]} 
              min={0.1} 
              max={5.0} 
              step={0.1}
              onValueChange={(value) => setSlippage(value[0])}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-crypto-darker border border-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Estimated Profit</div>
              <div className="text-xl font-bold text-neon-green">{profitEstimate} ETH</div>
            </div>
            <div className="bg-crypto-darker border border-gray-800 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Extractable MEV</div>
              <div className="text-xl font-bold text-neon-blue">{extractableValue} ETH</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Simulation Speed</Label>
              <Slider
                value={[simulationSpeed]}
                min={0.5}
                max={5}
                step={0.5}
                className="w-32"
                onValueChange={(value) => setSimulationSpeed(value[0])}
              />
            </div>
            <div className="space-x-2">
              {isRunning ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={pauseSimulation}
                  className="border-gray-700"
                >
                  <PauseCircle className="h-4 w-4 mr-1" /> Pause
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={startSimulation}
                  className="border-gray-700"
                >
                  <PlayCircle className="h-4 w-4 mr-1" /> Run
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetSimulation}
                className="border-gray-700"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SandwichSimulator;
