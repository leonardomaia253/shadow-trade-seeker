import { Call, SwapStep, BasicSwapStep, BuildOrchestrationParams } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildApproveCall } from "../../shared/build/buildApproveCall";
import { selectFlashloanToken } from "@/Arbitrum/utils/flashloanamount";
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
  const calls: Call[] =[];
  const preSwapDex = "uniswapv3"
  const postSwapDex = "uniswapv3"
  const firstStep = route[0];
  const lastStep = route[route.length - 1];
  const flashloanData = await selectFlashloanToken({ dex:"uniswapv3", tokenIn:firstStep.tokenIn, amountIn:firstStep.amountIn});
    if (!flashloanData) return;
    
    const { flashLoanToken, flashLoanAmount } = flashloanData;

  // Se for usar token alternativo (WETH), pré-swap de altToken -> tokenIn
  if (useAltToken) {
    if (!preSwapDex) throw new Error("preSwapDex não definido");

    const amountIn = firstStep.amountIn ?? BigInt(0);
    const amountInBN = BigNumber.from(amountIn.toString());

    // Aprova altToken para o primeiro DEX do pré-swap
    const preSwapSpender = typeof firstStep.poolData === "string"
      ? firstStep.poolData
      : firstStep.poolData?.router;
    if (!preSwapSpender) throw new Error("Router do pré-swap não definido");


    calls.push(buildApproveCall(altToken, preSwapSpender, amountIn.toString()));

    // Monta call de pré-swap (WETH → tokenIn)
    const preSwapStep: BasicSwapStep = {
      dex: preSwapDex,
      tokenIn: flashLoanToken,
      tokenOut: firstStep.tokenIn,
      amountIn: flashLoanAmount,
      poolData: firstStep.poolData,
    };
    const preSwapCall = await buildSwapTransaction[preSwapDex](preSwapStep, executor);
    calls.push(preSwapCall);
  }

  // Aprovação do tokenIn (depois do pré-swap ou original)
  const spender = typeof firstStep.poolData === "string"
    ? firstStep.poolData
    : firstStep.poolData?.router;
  if (!spender) throw new Error("Spender (router) não definido no primeiro passo");

  calls.push(buildApproveCall(firstStep.tokenIn, spender, (firstStep.amountIn ?? BigInt(0)).toString()));

  // Swaps da rota
  for (const step of route) {
    const buildFn = buildSwapTransaction[step.dex];
    if (!buildFn) throw new Error(`Builder não implementado para o DEX ${step.dex}`);
    const swapCall = await buildFn(step, executor);
    calls.push(swapCall);
  }

  // Pós-swap (token final → altToken) se usamos token alternativo
  if (useAltToken) {
    if (!postSwapDex) throw new Error("postSwapDex não definido");

    const spender = typeof lastStep.poolData === "string"
      ? lastStep.poolData
      : lastStep.poolData?.router;
    if (!spender) throw new Error("Router do pós-swap não definido");



    calls.push(buildApproveCall(lastStep.tokenOut, spender, (lastStep.amountOut ?? BigInt(0)).toString()));

    const postSwapStep: BasicSwapStep = {
      dex: postSwapDex,
      tokenIn: lastStep.tokenOut,
      tokenOut: flashLoanToken,
      amountIn: lastStep.amountOut,
      poolData: lastStep.poolData,
    };
    const postSwapCall = await buildSwapTransaction[postSwapDex](postSwapStep, executor);
    calls.push(postSwapCall);
  }

  return {calls, flashLoanAmount, flashLoanToken};
}
