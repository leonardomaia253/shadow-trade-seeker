
import { ethers } from "ethers";
import {BuiltRoute, CallData } from "../../utils/types";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";
import { simulateAndValidateRoute } from "../../simulation/simulateandvalidateroute";
import { sendBundle } from "../../executor/sendBundle";
import { enhancedLogger } from "../../utils/enhancedLogger";

export async function executeArbitrage({
  provider,
  signer,
  builtRoute,
  flashloanToken,
  flashloanAmount,
  minerBribeAmount,
}: {
  provider: ethers.providers.Provider;
  signer: ethers.Signer;
  builtRoute: BuiltRoute;
  flashloanToken: string;
  flashloanAmount: ethers.BigNumber;
  minerBribeAmount?: ethers.BigNumber;
}) {
  const userAddress = await signer.getAddress();

  const executor = new ethers.Contract(
    EXECUTOR_CONTRACTARBITRUM,
    [
      "function orchestrate((address provider,address token,uint256 amount)[],(address target,bytes data,bool requiresApproval,address approvalToken,uint256 approvalAmount)[]) external",
      "function payMinerERC20(address token, uint256 amount) external"
    ],
    signer
  );

  const flashloanRequest = [{
    provider: builtRoute.swaps[0].flashloanProvider,
    token: flashloanToken,
    amount: flashloanAmount,
  }];

  const calls: CallData[] = builtRoute.swaps.map(swap => ({
    target: swap.target,
    callData: swap.callData,
    requiresApproval: true,
    approvalToken: swap.approveToken,
    approvalAmount: swap.amountIn,
    value:  "0" // Add the missing value property
  }));

  const { ok, simulationUrl, profits } = await simulateAndValidateRoute(builtRoute, userAddress);
  if (!ok) {
    enhancedLogger.warn(`⚠️ Simulação falhou ou sem lucro. URL: ${simulationUrl}`, {
      botType: "arbitrage",
      data: { builtRoute }
    });
    return;
  }

  enhancedLogger.info(`✅ Simulação OK: ${simulationUrl}`, {
    botType: "arbitrage"
  });
  enhancedLogger.info(`💰 Lucro estimado: ${profits}`, {
    botType: "arbitrage"
  });

  // 1. Criar a transação do contrato
  const orchestrateTx = await executor.populateTransaction.orchestrate(flashloanRequest, calls);

  const txs: string[] = [];

  // 2. Miner bribe opcional
  if (minerBribeAmount && minerBribeAmount.gt(0)) {
    const bribeTx = await executor.populateTransaction.payMinerERC20(flashloanToken, minerBribeAmount);
    txs.push(await signer.signTransaction({
      ...bribeTx,
      from: userAddress,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(userAddress),
    }));
  }

  // 3. Assinar a arbitragem
  const orchestrateSigned = await signer.signTransaction({
    ...orchestrateTx,
    from: userAddress,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(userAddress) + txs.length,
  });

  txs.unshift(orchestrateSigned); // arbitragem primeiro

  // 4. Enviar via bundle
  const targetBlock = (await provider.getBlockNumber()) + 1;

  // Type cast to satisfy the required parameters
  const walletSigner = signer as ethers.Wallet;
  
  const result = await sendBundle(txs, walletSigner);

  if (result.success) {
    enhancedLogger.success(`✅ Bundle enviado com sucesso:`, {
      botType: "arbitrage",
      txHash: result.txHash
    });
  } else {
    enhancedLogger.error(`❌ Falha no envio de bundle:`, {
      botType: "arbitrage",
      data: result.error
    });
  }
}
