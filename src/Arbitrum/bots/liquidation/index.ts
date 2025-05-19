
import { JsonRpcProvider } from "@ethersproject/providers";
import { watchCompoundLiquidationEvents, getCompoundLiquidationOpportunities } from "./compoundLiquidationWatcher";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../Arbitrum/.env") });

const provider = new JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_KEY");

watchCompoundLiquidationEvents(provider, 19_000_000, async (users) => {
  const opportunities = await getCompoundLiquidationOpportunities(provider, users);
  for (const opp of opportunities) {
    console.log(`[!] User ${opp.user} pode ser liquidado. Shortfall: $${opp.shortfallUSD?.toFixed(2) || 'unknown'}`);
    // Aqui: monte e envie a tx de liquidação
  }
});
