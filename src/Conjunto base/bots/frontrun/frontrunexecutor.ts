
import { ethers } from "ethers";
import { buildFrontrunBundle } from "./frontrunbuilder";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";
import { sendBundle } from "../../executor/sendBundle";
import { provider, wallet } from "../../config/provider";
import { FrontrunOpportunity } from "../../utils/types";

export async function executeFrontrun(signer: ethers.Signer, opportunity: FrontrunOpportunity): Promise<boolean> {
  try {
    // Construir bundle com frontrun
    const bundleCalldata = await buildFrontrunBundle({
      signer,
      dex: opportunity.dex,
      frontrunBuyToken: opportunity.tokenIn,
      frontrunSellToken: opportunity.tokenOut,
      frontrunBuyAmount: opportunity.amountIn,
      frontrunSellAmount: opportunity.amountIn, // Use amountIn as fallback if amountOutMin is not available
      flashLoanToken: opportunity.tokenIn,
      flashLoanAmount: opportunity.amountIn,
      minerRewardToken: opportunity.tokenIn,
      minerRewardAmount: ethers.BigNumber.from(opportunity.amountIn).div(10) // 10% of amountIn as miner reward
    });

    // Assinar transação
    const signedTxs = [
      await wallet.signTransaction({
        to: bundleCalldata.target,
        data: bundleCalldata.callData,
        value: bundleCalldata.value || ethers.BigNumber.from(0),
        gasLimit: ethers.BigNumber.from(2_000_000),
        maxFeePerGas: ethers.BigNumber.from("10000000000"),         // 10 gwei
        maxPriorityFeePerGas: ethers.BigNumber.from("1000000000"),  // 1 gwei
        chainId: 42161,
        type: 2,
      }),
    ];

    // Simulação com Tenderly
    const sim = await simulateBundleWithTenderly(signedTxs, "42161");
    if (!sim.success) {
      console.warn("❌ Bundle reprovado na simulação, abortando.");
      return false;
    }

    // Enviar bundle no próximo bloco
    const nextBlockNumber = (await provider.getBlockNumber()) + 1;
    
    // Format transactions for sendBundle
    const bundleTransactions = signedTxs.map(signedTx => ({
      signer: wallet,
      transaction: { raw: signedTx }
    }));
    
    await sendBundle(bundleTransactions, provider);

    console.log("[🚀] Frontrun bundle enviado com sucesso.");
    return true;
  } catch (error) {
    console.error("[⚠️] Erro ao executar frontrun:", error);
    return false;
  }
}
