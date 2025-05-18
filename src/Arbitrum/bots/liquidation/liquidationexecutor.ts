
// bots/liquidation/executor.ts
import { ethers } from "ethers";
import { buildLiquidationBundle } from "./liquidationbuilder";
import { LiquidationOpportunity } from "../../utils/types";
import { sendBundle } from "../../executor/sendBundle";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";

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
    const blockNumber = await provider.getBlockNumber();

    // Ensure all values are strings to match expected interface
    const collateralAsset = typeof opportunity.collateralAsset === 'string' 
      ? opportunity.collateralAsset 
      : opportunity.collateralAsset.address;
      
    const debtAsset = typeof opportunity.debtAsset === 'string' 
      ? opportunity.debtAsset 
      : opportunity.debtAsset.address;

    // Montar bundle com lógica off-chain
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

    // Assinar transação
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
    
    // Assinar a transação para obter o rawTx
    const signedTx = await signer.signTransaction(txRequest);
    
    // Simulação com Tenderly (pode aceitar txRequest ou rawTx dependendo da sua função)
    const sim = await simulateBundleWithTenderly([signedTx], "42161");
    if (!sim.success) {
      console.warn("❌ Bundle reprovado na simulação, abortando.");
      return false;
    }
    
    // Enviar bundle com a transação assinada (como array de raw txs)
    await sendBundle(
      [{ signer, transaction: { raw: signedTx } }],
      provider
    );
    
    return true;
  } catch (error) {
    console.error("Error executing liquidation:", error);
    return false;
  }
}
