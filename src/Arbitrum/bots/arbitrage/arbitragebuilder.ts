import { ethers } from "ethers";
import { Call, SwapStep } from "../../utils/types";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildApproveCall } from "../../shared/build/buildApproveCall";


export async function buildOrchestrationFromRoute(
  route: SwapStep[],
  executor: string
): Promise<Call[]> {
  const calls: Call[] = [];

  // Aprovação do token de entrada para o primeiro DEX
  const firstStep = route[0];
  const spender = typeof firstStep.poolData === "string"? firstStep.poolData: firstStep.poolData?.router;
  const amountIn = firstStep.amountIn ?? BigInt(0); // Use o valor real
  if (!spender) throw new Error("Spender (router) não definido no primeiro passo");
  calls.push(buildApproveCall(firstStep.tokenIn, spender, (amountIn.toString())));

  // Executa swaps dinamicamente conforme DEX
  for (const step of route) {
    const buildFn = buildSwapTransaction[step.dex];
    if (!buildFn) throw new Error(`Builder não implementado para o DEX ${step.dex}`);
    const swapCall = await buildFn(step, executor);
    calls.push(swapCall);
  }

  // Bribe (pode vir de parâmetro também)
  const bribe = encodePayMiner(
    executor,
    "0xWETHAddress", // Troque pelo token usado para bribe
    BigInt(10 ** 16) // 0.01 ETH em wei
  );
  calls.push(bribe);

  return calls;
}
