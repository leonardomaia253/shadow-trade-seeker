// bots/liquidation/executor.ts
import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { buildLiquidationBundle } from "./liquidationbuilder";
import { LiquidationOpportunity } from "../../utils/types";
import { sendBundle } from "../../executor/sendBundle";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";

export async function executeLiquidation({
  provider,
  signer,
  opportunity,
}: {
  provider: JsonRpcProvider;
  signer: ethers.Wallet;
  opportunity: LiquidationOpportunity;
}): Promise<boolean> {
  try {
    const blockNumber = await provider.getBlockNumber();

    // Montar bundle com lógica off-chain
    const bundleTx = await buildLiquidationBundle({
      signer,
      collateralAsset: opportunity.collateralAsset,
      debtAsset: opportunity.debtAsset,
      userToLiquidate: opportunity.borrower,
      amountToRepay: opportunity.repayAmount.toString(),
      expectedProfitToken: opportunity.collateralAsset,
      flashLoanToken: opportunity.debtAsset,
      flashLoanAmount: opportunity.repayAmount.toString(),
      minerReward: ethers.BigNumber.from(opportunity.repayAmount).mul(5).div(100).toString(), // 5%
      protocol: opportunity.protocol,
    });

    // Assinar transação
    const txRequest = await signer.populateTransaction({
      to: bundleTx.target,
      data: bundleTx.data,
      value: bundleTx.value ?? 0n,
      gasLimit: 2_000_000n,
      maxFeePerGas: 10n ** 10n,
      maxPriorityFeePerGas: 10n ** 9n,
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
    await sendBundle([signedTx], blockNumber, signer, {
      minTimestamp: Math.floor(Date.now() / 1000),
      alwaysSendToMevShare: true,
    });
}};