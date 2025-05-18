
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ArbitrageBot from "./pages/ArbitrageBot";
import ProfiterOneBot from "./pages/ProfiterOneBot";
import ProfiterTwoBot from "./pages/ProfiterTwoBot";
import LiquidationBot from "./pages/LiquidationBot";
import FrontrunBot from "./pages/FrontrunBot";
import SandwichBot from "./pages/SandwichBot";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/arbitrage" element={<ArbitrageBot />} />
          <Route path="/profiter-one" element={<ProfiterOneBot />} />
          <Route path="/profiter-two" element={<ProfiterTwoBot />} />
          <Route path="/liquidation" element={<LiquidationBot />} />
          <Route path="/frontrun" element={<FrontrunBot />} />
          <Route path="/sandwich" element={<SandwichBot />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
