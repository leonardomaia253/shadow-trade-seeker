import { ethers } from "ethers";
import { buildFrontrunBundle } from "./frontrunbuilder";
import { simulateBundleWithTenderly } from "../../utils/Tenderlysimulation";
import { sendBundle } from "../../executor/sendBundle";
import { provider, wallet } from "../../config/provider";
import { FrontrunOpportunity } from "../../utils/types";
import { BigNumber } from "ethers";

export async function executeFrontrun(signer: ethers.Signer, opportunity: FrontrunOpportunity): Promise<boolean> {
  try {
    // Construir bundle com frontrun
    const bundleCalldata = await buildFrontrunBundle({
      signer,
      dex: opportunity.dex,
      frontrunBuyToken: opportunity.tokenIn,
      frontrunSellToken: opportunity.tokenOut,
      frontrunBuyAmount: opportunity.amountIn,
      frontrunSellAmount: opportunity.amountOutMin,
      flashLoanToken: opportunity.tokenIn,
      flashLoanAmount: opportunity.amountIn,
      minerRewardToken: opportunity.tokenIn,
      minerRewardAmount: opportunity.amountIn,
    });

    // Assinar transação
    const signedTxs = [
      await wallet.signTransaction({
        to: bundleCalldata.target,
        data: bundleCalldata.data,
        value: BigNumber.from(bundleCalldata.value ?? 0),
        gasLimit: BigNumber.from(2_000_000),
        maxFeePerGas: BigNumber.from("10000000000"),         // 10 gwei
        maxPriorityFeePerGas: BigNumber.from("1000000000"),  // 1 gwei
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
    await sendBundle(signedTxs, nextBlockNumber, wallet, {
      minTimestamp: Math.floor(Date.now() / 1000),
      alwaysSendToMevShare: true,
    });

    console.log("[🚀] Frontrun bundle enviado com sucesso.");
    return true;
  } catch (error) {
    console.error("[⚠️] Erro ao executar frontrun:", error);
    return false;
  }
}
