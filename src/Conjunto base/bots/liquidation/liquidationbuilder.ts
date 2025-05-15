
// core/liquidation/builder.ts
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { CallData, DexType } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildLiquidationCall } from "../../shared/build/buildLiquidationCall";

export async function buildLiquidationBundle({
  signer,
  collateralAsset,
  debtAsset,
  userToLiquidate,
  amountToRepay,
  expectedProfitToken,
  flashLoanToken,
  flashLoanAmount,
  minerReward,
  protocol,
}: {
  signer: ethers.Signer;
  collateralAsset: string;
  debtAsset: string;
  userToLiquidate: string;
  amountToRepay: string;
  expectedProfitToken: string;
  flashLoanToken: string;
  flashLoanAmount: string;
  minerReward: string;
  protocol?: "aave" | "compound" | "morpho" | "venus" | "spark";
}): Promise<CallData> {
  const defaultDex = "uniswapv3" as DexType;

  // 1. Get liquidation call
  const liquidationCallRes = await buildLiquidationCall({
    fromToken: debtAsset,
    toToken: collateralAsset,
    amount: ethers.BigNumber.from(amountToRepay),
    slippage: 0.01,
    protocol
  });

  // Create a liquidation call that conforms to CallData
  const liquidationCall: CallData = {
    target: liquidationCallRes.target,
    callData: liquidationCallRes.callData,
    dex: defaultDex,
    requiresApproval: true,
    approvalToken: debtAsset,
    approvalAmount: ethers.BigNumber.from(amountToRepay),
    value: ethers.BigNumber.from(0)
  };

  // 2. Swap collateral received -> flashLoanToken
  const swapCall = await buildSwapTransaction({
    fromToken: collateralAsset,
    toToken: flashLoanToken,
    amount: ethers.BigNumber.from(flashLoanAmount).div(2), // Use half as estimation
    slippage: 0.01,
    dex: defaultDex
  });

  // 3. Pay miner with profit token
  const minerCallRaw = await encodePayMiner(
    expectedProfitToken,
    expectedProfitToken,
    BigInt(minerReward)
  );
  
  // Convert to proper CallData format
  const minerCall: CallData = {
    target: minerCallRaw.to,
    callData: minerCallRaw.data,
    dex: defaultDex,
    value: ethers.BigNumber.from(minerCallRaw.value.toString()),
    requiresApproval: false,
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0)
  };

  // 4. Group into calls
  const calls: CallData[] = [liquidationCall, swapCall, minerCall];

  // 5. Build flashloan calldata
  const orchestrateResult = await buildOrchestrateCall({
    token: flashLoanToken,
    amount: flashLoanAmount,
    calls,
  });

  // Convert orchestrate result to CallData format
  return {
    target: orchestrateResult.target,
    callData: orchestrateResult.data || "",
    dex: defaultDex,
    value: ethers.BigNumber.from(orchestrateResult.value || 0),
    requiresApproval: orchestrateResult.requiresApproval || false,
    approvalToken: orchestrateResult.approvalToken || ethers.constants.AddressZero,
    approvalAmount: ethers.BigNumber.from(orchestrateResult.approvalAmount || 0)
  };
}
