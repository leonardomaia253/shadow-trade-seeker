
// bots/frontrun/builder.ts
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { CallData, DexType } from "../../utils/types";
import { ERC20_ABI } from "../../constants/abis";
import { DEX_ROUTER } from "../../constants/dexes"; // mapeamento: dex => router
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";

export async function buildFrontrunBundle({
  signer,
  dex,
  frontrunBuyToken,
  frontrunSellToken,
  frontrunBuyAmount,
  frontrunSellAmount,
  flashLoanToken,
  flashLoanAmount,
  minerRewardToken,
  minerRewardAmount,
}: {
  signer: ethers.Signer;
  dex: string;
  frontrunBuyToken: string;
  frontrunSellToken: string;
  frontrunBuyAmount: ethers.BigNumberish;
  frontrunSellAmount: ethers.BigNumberish;
  flashLoanToken: string;
  flashLoanAmount: ethers.BigNumberish;
  minerRewardToken: string;
  minerRewardAmount: ethers.BigNumberish;
}): Promise<CallData> {
  const dexRouterAddress = DEX_ROUTER[dex as DexType];
  const typedDex = dex as DexType;
  
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${dex}`);

  const erc20 = new ethers.utils.Interface(ERC20_ABI);

  // 1. Approve flashLoanToken para uso no front-run
  const approveFlashLoanTokenCall: CallData = {
    target: flashLoanToken,
    callData: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(flashLoanAmount.toString())]),
    dex: typedDex,
    requiresApproval: false,
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0),
    value: ethers.BigNumber.from(0)
  };

  // 2. Approve frontrunBuyToken para uso no back-run
  const approveFrontrunBuyTokenCall: CallData = {
    target: frontrunBuyToken,
    callData: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(frontrunSellAmount.toString())]),
    dex: typedDex,
    requiresApproval: false,
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0),
    value: ethers.BigNumber.from(0)
  };

  // 3. Swap antes do alvo (front-run)
  const buyCall = await buildSwapTransaction({
    fromToken: flashLoanToken,
    toToken: frontrunBuyToken,
    amount: ethers.BigNumber.from(frontrunBuyAmount),
    slippage: 0.01,
    dex: typedDex
  });

  // 4. Swap após alvo (back-run)
  const sellCall = await buildSwapTransaction({
    fromToken: frontrunBuyToken,
    toToken: frontrunSellToken,
    amount: ethers.BigNumber.from(frontrunSellAmount),
    slippage: 0.01,
    dex: typedDex
  });

  // 5. Pagamento ao minerador
  const minerCallRaw = await encodePayMiner(
    EXECUTOR_CONTRACTARBITRUM,
    minerRewardToken,
    BigInt(minerRewardAmount.toString())
  );
  
  // Convert to proper CallData format
  const minerCall: CallData = {
    target: minerCallRaw.to,
    callData: minerCallRaw.data,
    dex: typedDex,
    value: ethers.BigNumber.from(minerCallRaw.value.toString()),
    requiresApproval: false,
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0)
  };
  
  const calls: CallData[] = [
    approveFlashLoanTokenCall,
    approveFrontrunBuyTokenCall,
    buyCall,
    sellCall,
    minerCall,
  ];

  // 6. Encapsula tudo no flashloan
  const orchestrateResult = await buildOrchestrateCall({
    token: flashLoanToken,
    amount: flashLoanAmount,
    calls,
  });

  // Return properly formatted CallData object
  return {
    target: orchestrateResult.target,
    callData: orchestrateResult.data || "",
    dex: typedDex,
    value: ethers.BigNumber.from(orchestrateResult.value || 0),
    requiresApproval: orchestrateResult.requiresApproval || false,
    approvalToken: orchestrateResult.approvalToken || "",
    approvalAmount: ethers.BigNumber.from(orchestrateResult.approvalAmount || 0)
  };
}
