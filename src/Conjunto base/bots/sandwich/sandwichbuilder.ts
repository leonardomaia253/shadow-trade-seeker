// bots/frontrun/builder.ts
import { ethers } from "ethers";
import { encodePayMiner }  from "../../shared/build/payMinerCall";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { CallData } from "../../utils/types";
import { ERC20_ABI } from "../../constants/abis";
import { DEX_ROUTER } from "../../constants/addresses"; // mapeamento: dex => router
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";

export async function buildSandwichBundle({
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
  frontrunBuyAmount: string;
  frontrunSellAmount: string;
  flashLoanToken: string;
  flashLoanAmount: string;
  minerRewardToken: string;
  minerRewardAmount: string;
}): Promise<CallData> {
  const dexRouterAddress = DEX_ROUTER[dex];
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${dex}`);

  const erc20 = new ethers.utils.Interface(ERC20_ABI);

  // 1. Approve flashLoanToken para uso no front-run
  const approveFlashLoanTokenCall = {
    target: flashLoanToken,
    data: erc20.encodeFunctionData("approve", [dexRouterAddress, flashLoanAmount]),
  };

  // 2. Approve frontrunBuyToken para uso no back-run
  const approveFrontrunBuyTokenCall = {
    target: frontrunBuyToken,
    data: erc20.encodeFunctionData("approve", [dexRouterAddress, frontrunSellAmount]),
  };

  // 3. Swap antes do alvo (front-run)
  const buyCall = await buildSwapTransaction({
    signer,
    dex,
    fromToken: flashLoanToken,
    toToken: frontrunBuyToken,
    amount: frontrunBuyAmount,
  });

  // 4. Swap após alvo (back-run)
  const sellCall = await buildSwapTransaction({
    signer,
    dex,
    fromToken: frontrunBuyToken,
    toToken: frontrunSellToken,
    amount: frontrunSellAmount,
  });

  // 5. Pagamento ao minerador
  const minerCall = await encodePayMiner({
    token: minerRewardToken,
    amount: minerRewardAmount,
  });

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
