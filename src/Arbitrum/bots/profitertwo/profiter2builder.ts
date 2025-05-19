
import { Call, SwapStep, BasicSwapStep, BuildOrchestrationParams } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildApproveCall } from "../../shared/build/buildApproveCall";
import { selectFlashloanToken } from "@/Arbitrum/utils/flashloanamount";
import { BigNumber } from "ethers";
import { FLASHLOAN_CONTRACTS } from "../../constants/contracts";

interface OrchestrationResult {
  calls: Call[];
  flashLoanAmount: BigNumber;
  flashLoanToken: string;
}

// Lista de provedores de flashloan em ordem de preferência
const FLASHLOAN_PROVIDERS = [
  {
    name: "AAVE_V3",
    address: FLASHLOAN_CONTRACTS.AAVE_V3,
    tokens: ["0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"] // WETH, USDC
  },
  {
    name: "BALANCER",
    address: FLASHLOAN_CONTRACTS.BALANCER,
    tokens: ["0x82af49447d8a07e3bd95bd0d56f35241523fbab1", "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"] // WETH, USDC
  },
  {
    name: "UNISWAP_V3",
    address: FLASHLOAN_CONTRACTS.UNISWAP_V3,
    tokens: ["0x82af49447d8a07e3bd95bd0d56f35241523fbab1"] // Apenas WETH
  }
];

/**
 * Seleciona o melhor provedor de flashloan com base no token e quantidade
 * @param token Token a ser emprestado
 * @param amount Quantidade necessária
 */
async function selectBestFlashloanProvider(token: string, amount: BigNumber): Promise<string> {
  // Por padrão, usamos AAVE V3 como provedor principal
  let bestProvider = FLASHLOAN_PROVIDERS[0].address;
  
  // Verifica se o token é suportado por cada provedor
  for (const provider of FLASHLOAN_PROVIDERS) {
    if (provider.tokens.includes(token.toLowerCase())) {
      return provider.address;
    }
  }
  
  return bestProvider;
}

/**
 * Constrói a orquestração para executar uma sequência de swaps com flashloan
 */
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
  
  // Obtém detalhes do flashloan
  const flashloanData = await selectFlashloanToken({ 
    dex: "uniswapv3", 
    tokenIn: firstStep.tokenIn, 
    amountIn: firstStep.amountIn 
  });
  
  if (!flashloanData) return;
  
  const { flashLoanToken, flashLoanAmount } = flashloanData;
  
  // Seleciona o melhor provedor de flashloan
  const flashloanProvider = await selectBestFlashloanProvider(flashLoanToken, flashLoanAmount);
  
  console.log(`🔄 Usando flashloan de ${flashLoanAmount} tokens via ${flashloanProvider}`);

  // Se for usar token alternativo (WETH), faz pré-swap de altToken -> tokenIn
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

    // Monta call de pré-swap (altToken → tokenIn)
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

  // Aprovação do tokenIn para o primeiro swap
  const spender = typeof firstStep.poolData === "string"
    ? firstStep.poolData
    : firstStep.poolData?.router;
  if (!spender) throw new Error("Spender (router) não definido no primeiro passo");

  calls.push(buildApproveCall(firstStep.tokenIn, spender, (firstStep.amountIn ?? BigInt(0)).toString()));

  // Executa cada swap da rota
  for (const step of route) {
    const buildFn = buildSwapTransaction[step.dex];
    if (!buildFn) throw new Error(`Builder não implementado para o DEX ${step.dex}`);
    
    try {
      const swapCall = await buildFn(step, executor);
      calls.push(swapCall);
    } catch (error) {
      console.error(`Erro ao construir swap para ${step.dex}:`, error);
      throw error;
    }
  }

  // Se usamos token alternativo, fazemos pós-swap (token final → altToken)
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

  // Log final com resumo da orquestração
  console.log(`✅ Orquestração construída: ${calls.length} chamadas, flashloan de ${flashLoanAmount.toString()} ${flashLoanToken}`);

  return {
    calls, 
    flashLoanAmount, 
    flashLoanToken
  };
}
