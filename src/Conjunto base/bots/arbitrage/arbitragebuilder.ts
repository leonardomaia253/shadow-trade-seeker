import { ethers } from "ethers";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { ArbitrageRoute, CallData, DexType } from "../../utils/types";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";

export async function buildArbitrageBundle({
  dex,
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

  // Construir as chamadas de swap da rota
  const swapCalls: CallData[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const swapCall = await buildSwapTransaction({
      fromToken: from.address,
      toToken: to.address,
      amount: flashLoanAmount, // BigNumber, conforme esperado
      dex:dex,// dex: "uniswapv3", // se necessário, especifique o dex aqui
      // signer, // se a função aceitar
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
    value: ethers.BigNumber.from(payMinerCallRaw.value.toString()),
    dex: "uniswapv3" as DexType, // ajuste conforme seu enum / tipo DexType
  };

  // Agrupar todas as chamadas
  const calls = [...swapCalls, payMinerCall];

  // Montar calldata do flashloan
  const calldata = await buildOrchestrateCall({
    token: baseToken.address,
    amount: flashLoanAmount.toString(),
    calls,
  });

  return calldata;
}
