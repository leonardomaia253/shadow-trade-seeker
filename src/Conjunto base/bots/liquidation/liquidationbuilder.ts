
// core/liquidation/builder.ts
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner} from "../../shared/build/payMinerCall"
import { CallData } from "../../utils/types";
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
  protocol?: "aave" |"compound" | "morpho" | "venus" | "spark";
}): Promise<CallData> {


  // 1. Get liquidation call
  const liquidationCallRes = await buildLiquidationCall({
    protocol,
    borrower: userToLiquidate,
    debtAsset,
    collateralAsset,
    repayAmount: ethers.BigNumber.from(amountToRepay),
    liquidator: signer,
  });

  // Create a liquidation call that conforms to CallData
  const liquidationCall: CallData = {
    target: liquidationCallRes.to,
    callData: liquidationCallRes.data,
    requiresApproval: true,
    approvalToken: debtAsset,
    approvalAmount: amountToRepay,
    protocol,
  };

  // 2. Swap collateral received -> flashLoanToken
  const swapCall = await buildSwapTransaction({
    signer,
    fromToken: collateralAsset,
    toToken: flashLoanToken,
    amount, // actual value will be resolved at execution
  });

  // 3. Pay miner with profit token
  const minerCall = await encodePayMiner({
    token: expectedProfitToken,
    amount: minerReward,
  });

  // 4. Group into calls
  const calls = [liquidationCall, swapCall, minerCall];

  // 5. Build flashloan calldata
  const calldata = await buildOrchestrateCall({
    token: flashLoanToken,
    amount: flashLoanAmount,
    calls,
  });

  return calldata;
}
