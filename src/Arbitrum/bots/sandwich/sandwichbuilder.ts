import { ethers, BigNumber } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { CallData, DexType } from "../../utils/types";
import { ERC20_ABI } from "../../constants/abis";
import { DEX_ROUTER } from "../../constants/dexes";
import { estimateSwapOutput } from "@/Arbitrum/shared/utils/QuoteRouter";


export async function buildFrontrunBundlelongo({
  dex,
  tokenIn,
  tokenOut,
  amountIn, 
  amountOutMin, 
  recipient,
  flashLoanToken,
  flashLoanAmount,
}: {
  dex: DexType;
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOutMin:ethers.BigNumber;
  recipient: string;
  flashLoanToken: string;
  flashLoanAmount: BigNumber;
  
}): Promise<CallData> {
  const frontRunToken = tokenIn;
  const frontRunAmount = amountIn;
  const BackRunToken = tokenOut;
  const BackRunAmount = amountOutMin;
  const dexRouterAddress = DEX_ROUTER[dex];
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${dex}`);
  const erc20 = new ethers.utils.Interface(ERC20_ABI);
  const amountToApproveflash = flashLoanAmount.mul(2);
  const amountToApprovebuy = frontRunAmount.mul(2);
  const amountToApprovesell = BackRunAmount.mul(2);
  const wethInterface = new ethers.utils.Interface(["function withdraw(uint256 wad)"]);

  const approveCalls: CallData[] = [
    {
      to: flashLoanToken,
      data: erc20.encodeFunctionData("approve", [dexRouterAddress, amountToApproveflash]),
      dex,
      requiresApproval: true,
      approvalToken: flashLoanToken,
      approvalAmount: amountToApproveflash,
      value: BigNumber.from(0)
    },
    {
      to: frontRunToken,
      data: erc20.encodeFunctionData("approve", [dexRouterAddress, amountToApprovebuy]),
      dex,
      requiresApproval: true,
      approvalToken: frontRunToken,
      approvalAmount: amountToApprovebuy,
      value: BigNumber.from(0)
    },
    {
      to: BackRunToken,
      data: erc20.encodeFunctionData("approve", [dexRouterAddress, amountToApprovesell]),
      dex,
      requiresApproval: true,
      approvalToken: BackRunToken,
      approvalAmount: amountToApprovesell,
      value: BigNumber.from(0)
    },
  ];

   const expectedAmountBuy = await estimateSwapOutput(frontRunToken, BackRunToken, frontRunAmount, dex);
   const expectedAmountSell = await estimateSwapOutput(frontRunToken, BackRunToken, expectedAmountBuy, dex);
   const expectedAmountBuy2 = await estimateSwapOutput(BackRunToken, BackRunToken, expectedAmountSell, dex);
   const expectedAmountFlash = await estimateSwapOutput(frontRunToken, flashLoanToken,expectedAmountBuy2, dex);

  const [buyCall, frontrunToVictimCall, victimBackToFrontrunCall, frontrunToFlashLoanCall] = await Promise.all([
    buildSwapTransaction({
      tokenIn: flashLoanToken,
      tokenOut: frontRunToken,
      amountIn: flashLoanAmount,
      amountOutMin: expectedAmountBuy,
      dex,
      recipient,
    }),
    buildSwapTransaction({
      tokenIn: frontRunToken,
      tokenOut: BackRunToken,
      amountIn: frontRunAmount,
      amountOutMin: expectedAmountSell,
      dex,
      recipient,
    }),
    buildSwapTransaction({
      tokenIn: BackRunToken,
      tokenOut: frontRunToken,
      amountIn: BackRunAmount,
      amountOutMin: expectedAmountBuy2,
      dex,
      recipient,
    }),
    buildSwapTransaction({
      tokenIn: frontRunToken,
      tokenOut: flashLoanToken,
      amountIn: frontRunAmount,
      amountOutMin: expectedAmountFlash,
      dex,
      recipient,
    })
  ]);

  const calls: CallData[] = [
    ...approveCalls,
    buyCall,
    frontrunToVictimCall,
    victimBackToFrontrunCall,
    frontrunToFlashLoanCall,
  ];

  const orchestrateResult = await buildOrchestrateCall({
    token: flashLoanToken,
    amount: flashLoanAmount,
    calls
  });

  return {
    to: orchestrateResult.to,
    data: orchestrateResult.data || "",

  };
}


export async function buildFrontrunBundlecurto({
  dex,
  tokenIn,
  tokenOut,
  amountIn, 
  amountOutMin, 
  recipient, 
}: {
  dex: DexType;
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOutMin:ethers.BigNumber;
  recipient: string;
  
}): Promise<CallData> {
  const frontRunToken = tokenIn;
  const frontRunAmount = amountIn;
  const BackRunToken = tokenOut;
  const BackRunAmount = amountOutMin;
  const dexRouterAddress = DEX_ROUTER[dex];
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${dex}`);
  const erc20 = new ethers.utils.Interface(ERC20_ABI);
  const amountToApprovebuy = frontRunAmount.mul(2);
  const amountToApprovesell = BackRunAmount.mul(2);

  const approveCalls: CallData[] = [
    {
      to: frontRunToken,
      data: erc20.encodeFunctionData("approve", [dexRouterAddress, amountToApprovebuy]),
      dex,
      requiresApproval: true,
      approvalToken: frontRunToken,
      approvalAmount: amountToApprovebuy,
      value: BigNumber.from(0)
    },
    {
      to: BackRunToken,
      data: erc20.encodeFunctionData("approve", [dexRouterAddress, amountToApprovesell]),
      dex,
      requiresApproval: true,
      approvalToken: BackRunToken,
      approvalAmount: amountToApprovesell,
      value: BigNumber.from(0)
    },
  ];

  const expectedAmountSell = await estimateSwapOutput(frontRunToken, BackRunToken, frontRunAmount, dex);
  const expectedAmountBuy = await estimateSwapOutput(BackRunToken, BackRunToken, BackRunAmount, dex);

  const [buyCall, frontrunToVictimCall] = await Promise.all([
    buildSwapTransaction({
      tokenIn: frontRunToken,
      tokenOut: BackRunToken,
      amountIn: frontRunAmount,
      amountOutMin: expectedAmountSell.mul(995).div(1000),
      dex,
      recipient,
    }),
    buildSwapTransaction({
      tokenIn: BackRunToken,
      tokenOut: frontRunToken,
      amountIn: frontRunAmount,
      amountOutMin: expectedAmountBuy.mul(995).div(1000),
      dex,
      recipient,
    }),
  ]);

  const calls: CallData[] = [
    ...approveCalls,
    buyCall,
    frontrunToVictimCall,
  ];

  const orchestrateResult = await buildOrchestrateCall({
    token: frontRunToken,
    amount: frontRunAmount,
    calls
  });

  return {
    to: orchestrateResult.to,
    data: orchestrateResult.data || "",
  };
}

