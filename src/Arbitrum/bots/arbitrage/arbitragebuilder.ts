import { Call, SwapStep, BasicSwapStep, BuildOrchestrationParams } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap.ts";
import { buildApproveCall } from "../../shared/build/buildApproveCall";
import { selectFlashloanToken } from "../../utils/flashloanamount";
import { BigNumber } from "ethers";

interface OrchestrationResult {
  calls: Call[];
  flashLoanAmount: BigNumber;
  flashLoanToken: string;
}

export async function buildOrchestrationFromRoute({
  route,
  executor,
  useAltToken,
  altToken,
}: BuildOrchestrationParams): Promise<OrchestrationResult | undefined> {
  const calls: Call[] = [];
  const preSwapDex = "uniswapv3";
  const postSwapDex = "uniswapv3";

  const firstStep = route[0];
  const lastStep = route[route.length - 1];

  const flashloanData = await selectFlashloanToken({
    dex: "uniswapv3",
    tokenIn: firstStep.tokenIn,
    amountIn: firstStep.amountIn,
  });

  if (!flashloanData) return;

  const { flashLoanToken, flashLoanAmount } = flashloanData;

  // Se for usar token alternativo (WETH), pré-swap de altToken -> tokenIn
  if (useAltToken) {
    if (!preSwapDex) throw new Error("preSwapDex não definido");

    const preSwapSpender =
      typeof firstStep.poolData === "string"
        ? firstStep.poolData
        : firstStep.poolData?.router;
    if (!preSwapSpender) throw new Error("Router do pré-swap não definido");

    // Aprovação do altToken para o router do pré-swap
    calls.push(buildApproveCall(altToken, preSwapSpender, flashLoanAmount.toString()));

    const preSwapStep: BasicSwapStep = {
      dex: preSwapDex,
      tokenIn: flashLoanToken,
      tokenOut: firstStep.tokenIn,
      amountIn: flashLoanAmount,
      poolData: firstStep.poolData,
    };
    const preSwapCall = await buildSwapTransaction[preSwapDex](preSwapStep, executor);
    calls.push(preSwapCall);
  } else {
    // Aprovação do tokenIn original, se não houver pré-swap
    const spender =
      typeof firstStep.poolData === "string"
        ? firstStep.poolData
        : firstStep.poolData?.router;
    if (!spender) throw new Error("Spender (router) não definido no primeiro passo");

    calls.push(
      buildApproveCall(
        firstStep.tokenIn,
        spender,
        (firstStep.amountIn ?? BigInt(0)).toString()
      )
    );
  }

  // Swaps principais da rota
  for (const step of route) {
    const buildFn = buildSwapTransaction[step.dex];
    if (!buildFn) throw new Error(`Builder não implementado para o DEX ${step.dex}`);
    const swapCall = await buildFn(step, executor);
    calls.push(swapCall);
  }

  // Pós-swap (token final → altToken) se usamos token alternativo
  if (useAltToken) {
    if (!postSwapDex) throw new Error("postSwapDex não definido");

    const postSwapSpender =
      typeof lastStep.poolData === "string"
        ? lastStep.poolData
        : lastStep.poolData?.router;
    if (!postSwapSpender) throw new Error("Router do pós-swap não definido");

    const postSwapAmountIn = lastStep.amountOut;
    if (!postSwapAmountIn) throw new Error("amountOut não definido para o último passo");

    calls.push(buildApproveCall(lastStep.tokenOut, postSwapSpender, postSwapAmountIn.toString()));

    const postSwapStep: BasicSwapStep = {
      dex: postSwapDex,
      tokenIn: lastStep.tokenOut,
      tokenOut: flashLoanToken,
      amountIn: postSwapAmountIn,
      poolData: lastStep.poolData,
    };
    const postSwapCall = await buildSwapTransaction[postSwapDex](postSwapStep, executor);
    calls.push(postSwapCall);
  }

  return {
    calls,
    flashLoanAmount,
    flashLoanToken,
  };
}
