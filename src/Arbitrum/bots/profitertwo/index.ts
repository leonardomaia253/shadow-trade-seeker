// Import required libraries and modules
import path from "path";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import { Database } from "../../../types/database.types";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Other imports...
import { findArbitrageOpportunities } from "./profiter2scanner";
import { buildAndExecuteArbitrage } from "./profiter2builder";
import { Token } from "../../constants/tokens";

// Setup logger and other utilities
import { Logger } from "../../utils/enhancedLogger";
import { startMemoryMonitoring } from "../../utils/mempool";
import { ErrorWithContext } from "../../utils/errorHandler";
import { calculateTokensPriceImpactAndProfit } from "../../utils/getPriceImpactAndProfit";
import { getArbConfig } from "../../utils/config";
import { healthCheck } from "../../utils/healthMonitor";
import { createContextLogger } from "../../utils/enhancedLogger";
import { startHealthServer, updateBotMetrics, updateBotStatus, registerShutdownHandlers } from "../../utils/healthMonitor";
import { createBotModuleLogger, checkDependencies } from "../../utils/botLogger";
import { providers } from "ethers";

// Initialize Supabase client for database interaction
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseKey);
