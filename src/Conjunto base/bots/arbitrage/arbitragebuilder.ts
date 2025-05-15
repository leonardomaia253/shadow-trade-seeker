
import { ethers } from "ethers";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { ArbitrageRoute, CallData, DexType } from "../../utils/types";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";

export async function buildArbitrageBundle({
  signer,
  route,
  flashLoanAmount,
  minerRewardPercent = 0.9,
}: {
  signer: ethers.Signer;
  route: ArbitrageRoute;
  flashLoanAmount: ethers.BigNumber;
  minerRewardPercent?: number; // 0.9 = 90% do lucro
}): Promise<CallData> {
  const { path, netProfit } = route;
  const baseToken = path[0];
  const defaultDex = "uniswapv3" as DexType; // Default DEX to use

  // Construir as chamadas de swap da rota
  const swapCalls: CallData[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const swapCall = await buildSwapTransaction({
      fromToken: from.address,
      toToken: to.address,
      amount: flashLoanAmount, // BigNumber, conforme esperado
      dex: defaultDex, // specify the dex explicitly
    });

    swapCalls.push(swapCall);
  }

  const netProfitBN = ethers.BigNumber.from(netProfit);
  if (netProfitBN.lte(0)) {
    throw new Error("Net profit must be positive to proceed.");
  }

  // Cálculo de bribe do minerador (usando base 10_000 para mais precisão)
  const minerReward = netProfitBN.mul(Math.round(minerRewardPercent * 10000)).div(10000);

  // Chamada raw para pagar o minerador
  const payMinerCallRaw = await encodePayMiner(
    EXECUTOR_CONTRACTARBITRUM,
    baseToken.address,
    BigInt(minerReward.toString())
  );

  // Montar objeto CallData correto para o payMiner
  const payMinerCall: CallData = {
    target: payMinerCallRaw.to,
    callData: payMinerCallRaw.data,
    dex: defaultDex,
    value: ethers.BigNumber.from(payMinerCallRaw.value.toString()),
    requiresApproval: false,
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0),
  };

  // Agrupar todas as chamadas
  const calls = [...swapCalls, payMinerCall];

  // Montar calldata do flashloan
  const calldata = await buildOrchestrateCall({
    token: baseToken.address,
    amount: flashLoanAmount.toString(),
    calls,
  });

  // Add required properties for CallData
  return {
    target: calldata.target,
    callData: calldata.data || "",
    dex: defaultDex,
    value: ethers.BigNumber.from(0),
    requiresApproval: calldata.requiresApproval || false,
    approvalToken: calldata.approvalToken || ethers.constants.AddressZero,
    approvalAmount: ethers.BigNumber.from(calldata.approvalAmount || 0)
  };
}
