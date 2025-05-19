
import { ethers } from "ethers";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate";
import { encodePayMiner } from "../../shared/build/payMinerCall";
import { CallData, DexType, AccountHealthData, LiquidationBundleParams, ProtocolType } from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { getLiquidationCallData } from "../../shared/build/buildLiquidationCall";

// Define the LENDING_PROTOCOL_ADDRESSES if it's missing
const LENDING_PROTOCOL_ADDRESSES: Record<ProtocolType, string> = {
  "aave": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  "compound": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1",
  "morpho": "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  "spark": "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  "venus": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1",
  "abracadabra": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1",
  "radiant": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  "llamalend": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1",
  "creamfinance": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1",
  "ironbank": "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1"
};

export async function prepareAndBuildLiquidationCall(
  healthData: AccountHealthData,
  signer: ethers.Signer,
  protocol: LiquidationBundleParams["protocol"]
) {
  const debtAsset = healthData.debt[0]; // escolha a dívida mais relevante
  const collateralAsset = healthData.collateral[0]; // idem para colateral

  const params: LiquidationBundleParams = {
    signer,
    collateralAsset: collateralAsset.token,
    debtAsset: debtAsset.token,
    userToLiquidate: healthData.user,
    amountToRepay: ethers.utils.parseUnits(
      debtAsset.amount.toString(),
      debtAsset.decimals || 18
    ).toString(),
    expectedProfitToken: collateralAsset.token, // ou outro token de destino
    flashLoanToken: debtAsset.token,
    flashLoanAmount: ethers.utils.parseUnits(
      debtAsset.amount.toString(),
      debtAsset.decimals || 18
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
      collateralAsset,
      debtAsset,
      user: userToLiquidate,
      amount: ethers.BigNumber.from(amountToRepay),
      receiveAToken: false
    }
  });

  // Create a liquidation call that conforms to CallData
  const liquidationCall: CallData = {
    to: liquidationCallRes.target,
    data: liquidationCallRes.callData,
    dex: defaultDex,
    requiresApproval: true,
    approvalToken: debtAsset,
    approvalAmount: ethers.BigNumber.from(amountToRepay),
    value: ethers.BigNumber.from(0)
  };

  // 2. Swap collateral received -> flashLoanToken
  const swapCallData = await buildSwapTransaction[defaultDex]({
    tokenIn: collateralAsset,
    tokenOut: flashLoanToken,
    amountIn: ethers.BigNumber.from(flashLoanAmount).div(2), // Use half as estimation
    dex: defaultDex
  }, dexRouterAddress);

  // Create proper CallData format for swap
  const swapCall: CallData = {
    to: dexRouterAddress,
    data: swapCallData.data,
    dex: defaultDex,
    value: ethers.BigNumber.from(0),
    requiresApproval: true,
    approvalToken: collateralAsset,
    approvalAmount: ethers.BigNumber.from(flashLoanAmount).div(2)
  };

  // 3. Pay miner with profit token
  const minerCallRaw = await encodePayMiner(
    expectedProfitToken,
    expectedProfitToken,
    BigInt(minerReward)
  );
  
  // Convert to proper CallData format
  const minerCall: CallData = {
    to: minerCallRaw.to || "",
    data: String(minerCallRaw.data || ""), // Fix: Explicitly convert BytesLike to string
    dex: defaultDex,
    value: ethers.BigNumber.from(minerCallRaw.value?.toString() || "0"),
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
    to: orchestrateResult.to || "",
    data: String(orchestrateResult.data || ""),
    dex: defaultDex,
    value: ethers.BigNumber.from("0"), // Fix: orchestrateResult.value doesn't exist, using default "0"
    requiresApproval: false, // The orchestrate contract handles approvals internally
    approvalToken: "",
    approvalAmount: ethers.BigNumber.from(0)
  };
}
