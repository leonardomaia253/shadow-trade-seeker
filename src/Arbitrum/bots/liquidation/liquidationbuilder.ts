
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { CallData, DexType } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { getLiquidationCallData } from "../../shared/build/buildLiquidationCall";
import { LENDING_PROTOCOL_ADDRESSES } from "../../constants/dexes"; 

// Define the missing types
interface AccountHealthData {
  user: string;
  debt: Array<{address: string, amount: number, decimals: number}>;
  collateral: Array<{address: string, amount: number, decimals: number}>;
}

interface LiquidationBundleParams {
  signer: ethers.Signer;
  collateralAsset: string;
  debtAsset: string;
  userToLiquidate: string;
  amountToRepay: string;
  expectedProfitToken: string;
  flashLoanToken: string;
  flashLoanAmount: string;
  minerReward: string;
  protocol: "aave" | "compound" | "morpho" | "venus" | "spark";
}

type ProtocolType = "aave" | "compound" | "morpho" | "venus" | "spark" | "uniswapv3";

export async function prepareAndBuildLiquidationCall(
  healthData: AccountHealthData,
  signer: ethers.Signer,
  protocol: LiquidationBundleParams["protocol"]
) {
  const debtAsset = healthData.debt[0]; // escolha a dívida mais relevante
  const collateralAsset = healthData.collateral[0]; // idem para colateral

  const params: LiquidationBundleParams = {
    signer,
    collateralAsset: collateralAsset.address,
    debtAsset: debtAsset.address,
    userToLiquidate: healthData.user,
    amountToRepay: ethers.utils.parseUnits(
      debtAsset.amount.toString(),
      debtAsset.decimals
    ).toString(),
    expectedProfitToken: collateralAsset.address, // ou outro token de destino
    flashLoanToken: debtAsset.address,
    flashLoanAmount: ethers.utils.parseUnits(
      debtAsset.amount.toString(),
      debtAsset.decimals
    ).toString(),
    minerReward: "0", // ou calcule dinamicamente
    protocol,
  };

  const bundle = await buildLiquidationBundle(params);
  return bundle;
}

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
}: LiquidationBundleParams): Promise<CallData> {
  const defaultDex: DexType = "uniswapv3"; 
  const protocolAddress = LENDING_PROTOCOL_ADDRESSES[protocol as ProtocolType];
  const dexRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 Router
    
  if (!dexRouterAddress) throw new Error(`[builder] Router address not found for DEX: ${defaultDex}`);

  // 1. Get liquidation call
  const liquidationCallRes = await getLiquidationCallData({
    protocol: protocol,
    params: {
      fromToken: debtAsset,
      toToken: collateralAsset,
      amount: ethers.BigNumber.from(amountToRepay),
      slippage: 0.01
    }
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
  const swapCall = await buildSwapTransaction[defaultDex]({
    tokenIn: collateralAsset,
    tokenOut: flashLoanToken,
    amountIn: ethers.BigNumber.from(flashLoanAmount).div(2), // Use half as estimation
    dex: defaultDex
  }, "0x0");

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
