
// bots/liquidation/executor.ts
import { ethers } from "ethers";
import { buildLiquidationBundle } from "./liquidationbuilder";
import { LiquidationOpportunity } from "../../utils/types";
import { sendBundle } from "../../executor/sendBundle";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";
import { createContextLogger } from "../../utils/enhancedLogger";

// Create logger for this module
const log = createContextLogger({
  botType: "liquidation",
  source: "executor"
});

export async function executeLiquidation({
  provider,
  signer,
  opportunity,
}: {
  provider: ethers.providers.JsonRpcProvider;
  signer: ethers.Wallet;
  opportunity: LiquidationOpportunity;
}): Promise<boolean> {
  try {
    log.info("Starting liquidation execution", {
      category: "execution",
      protocol: opportunity.protocol,
      user: opportunity.userAddress
    });
    
    const blockNumber = await provider.getBlockNumber();
    log.debug("Current block number", { category: "blockchain", blockNumber });

    // Ensure all values are strings to match expected interface
    const collateralAsset = typeof opportunity.collateralAsset === 'string' 
      ? opportunity.collateralAsset 
      : opportunity.collateralAsset.address;
      
    const debtAsset = typeof opportunity.debtAsset === 'string' 
      ? opportunity.debtAsset 
      : opportunity.debtAsset.address;

    log.info("Building liquidation bundle", {
      category: "build",
      collateralAsset,
      debtAsset,
      debtAmount: opportunity.debtAmount?.toString()
    });
    
    // Build bundle with off-chain logic
    const bundleTx = await buildLiquidationBundle({
      signer,
      collateralAsset,
      debtAsset,
      userToLiquidate: opportunity.userAddress || '',
      amountToRepay: opportunity.debtAmount?.toString() || '0',
      expectedProfitToken: collateralAsset,
      flashLoanToken: debtAsset,
      flashLoanAmount: opportunity.debtAmount?.toString() || '0',
      minerReward: ethers.BigNumber.from(opportunity.debtAmount || '0').mul(5).div(100).toString(), // 5%
      protocol: opportunity.protocol as "aave" | "compound" | "morpho" | "venus" | "spark",
    });

    log.debug("Liquidation bundle built successfully", {
      category: "build",
      target: bundleTx.target
    });

    // Populate transaction
    const txRequest = await signer.populateTransaction({
      to: bundleTx.target,
      data: bundleTx.callData,
      value: bundleTx.value?.toString() || "0",
      gasLimit: 2_000_000,
      maxFeePerGas: ethers.utils.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"),
      chainId: 42161,
      type: 2,
    });
    
    log.info("Signing transaction", { category: "execution" });
    // Sign the transaction to obtain the rawTx
    const signedTx = await signer.signTransaction(txRequest);
    
    log.info("Simulating liquidation with Tenderly", { category: "simulation" });
    // Simulation with Tenderly (using the updated function that accepts a serialized tx string)
    const sim = await simulateBundleWithTenderly([signedTx]);
    
    if (!sim.success) {
      log.warn("Bundle failed in simulation, aborting", {
        category: "simulation",
        error: sim.error
      });
      return false;
    }
    
    log.info("Simulation successful, sending bundle", { category: "execution" });
    // Send bundle with the signed transaction (as array of raw txs)
    await sendBundle(
      [{ signer, transaction: { raw: signedTx } }],
      provider
    );
    
    log.info("Liquidation bundle sent successfully", {
      category: "execution",
      protocol: opportunity.protocol,
      user: opportunity.userAddress
    });
    
    return true;
  } catch (error: any) {
    log.error("Error executing liquidation", {
      category: "exception", 
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}
