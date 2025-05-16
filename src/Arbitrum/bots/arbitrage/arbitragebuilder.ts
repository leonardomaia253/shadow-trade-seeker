
import { ethers } from "ethers";
import { Call, SwapStep } from "../../utils/types";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildApproveCall } from "../../shared/build/buildApproveCall";

const WETH_ADDRESS = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // Arbitrum WETH

export async function buildOrchestrationFromRoute(
  route: SwapStep[],
  executor: string
): Promise<Call[]> {
  const calls: Call[] = [];

  // Aprovação do token de entrada para o primeiro DEX
  const firstStep = route[0];
  const spender = typeof firstStep.poolData === "string"
    ? firstStep.poolData
    : firstStep.poolData?.router;
  const amountIn = firstStep.amountIn ?? BigInt(0);
  if (!spender) throw new Error("Spender (router) não definido no primeiro passo");
  calls.push(buildApproveCall(firstStep.tokenIn, spender, amountIn.toString()));

  // Executa swaps
  for (const step of route) {
    const buildFn = buildSwapTransaction[step.dex];
    if (!buildFn) throw new Error(`Builder não implementado para o DEX ${step.dex}`);
    const swapCall = await buildFn(step, executor);
    calls.push(swapCall);
  }

  // Unwrap WETH → ETH antes do pagamento do minerador
  const wethInterface = new ethers.utils.Interface([
    "function withdraw(uint256 wad)"
  ]);

  const unwrapAmount = BigInt(10 ** 16); // 0.01 WETH → ETH (ajuste conforme o lucro)
  const unwrapCall: Call = {
    target: WETH_ADDRESS,
    data: wethInterface.encodeFunctionData("withdraw", [unwrapAmount]),
    value: BigInt(0), // Fixed: Changed "0" string to BigInt(0)
  };
  calls.push(unwrapCall);

  // Bribe com ETH para o minerador (block.coinbase)
  const bribe = encodePayMiner(
    executor,
    ethers.constants.AddressZero, // ETH (native)
    unwrapAmount
  );
  calls.push(bribe);

  return calls;
}
