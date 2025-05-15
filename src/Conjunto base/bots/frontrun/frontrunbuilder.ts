
// bots/frontrun/builder.ts
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { buildSwapTransaction} from "../../shared/build//buildSwap";
import { CallData } from "../../utils/types";
import { ERC20_ABI } from "../../constants/abis";
import { DEX_ROUTER } from "../../constants/addresses"; // mapeamento: dex => router
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
  frontrunBuyAmount: Number;
  frontrunSellAmount: Number;
  flashLoanToken: string;
  flashLoanAmount: Number;
  minerRewardToken: string;
  minerRewardAmount: Number;
}): Promise<CallData> {
  const dexRouterAddress = DEX_ROUTER[dex];
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${dex}`);

  const erc20 = new ethers.utils.Interface(ERC20_ABI);

  // 1. Approve flashLoanToken para uso no front-run
  const approveFlashLoanTokenCall = {
    target: flashLoanToken,
    data: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(flashLoanAmount.toString())]),
    dex,
    callData: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(flashLoanAmount.toString())])
  };

  // 2. Approve frontrunBuyToken para uso no back-run
  const approveFrontrunBuyTokenCall = {
    target: frontrunBuyToken,
    data: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(frontrunSellAmount.toString())]),
    dex,
    callData: erc20.encodeFunctionData("approve", [dexRouterAddress, ethers.BigNumber.from(frontrunSellAmount.toString())])
  };

  // 3. Swap antes do alvo (front-run)
  const buyCall = await buildSwapTransaction({
    fromToken: flashLoanToken,
    toToken: frontrunBuyToken,
    amount: ethers.BigNumber.from(frontrunBuyAmount.toString()),
    slippage: 0.01,
    dex
  });

  // 4. Swap após alvo (back-run)
  const sellCall = await buildSwapTransaction({
    fromToken: frontrunBuyToken,
    toToken: frontrunSellToken,
    amount: ethers.BigNumber.from(frontrunSellAmount.toString()),
    slippage: 0.01,
    dex
  });

  // 5. Pagamento ao minerador
  const minerCall = await encodePayMiner(
    EXECUTOR_CONTRACTARBITRUM,
    minerRewardToken,
    BigInt(minerRewardAmount.toString())
  );
  
  const calls = [
    approveFlashLoanTokenCall,
    approveFrontrunBuyTokenCall,
    buyCall,
    sellCall,
    minerCall,
  ];

  // 6. Encapsula tudo no flashloan
  const calldata = await buildOrchestrateCall({
    token: flashLoanToken,
    amount: flashLoanAmount,
    calls,
  });

  return calldata;
}
