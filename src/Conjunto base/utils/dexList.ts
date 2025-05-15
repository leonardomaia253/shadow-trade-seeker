
import { DEX_ROUTER } from "../constants/addresses";

// Function to get a list of DEX router addresses to monitor
export async function getDexList(): Promise<string[]> {
  // Convert the router address map to an array of lowercase addresses
  return Object.values(DEX_ROUTER).map(address => 
    address.toLowerCase()
  );
}
