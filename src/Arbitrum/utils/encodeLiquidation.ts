
import { ethers } from "ethers";
import { CallData } from "./types";

/// Aave
export function buildAaveLiquidation({
  signer,
  fromToken,
  toToken,
  amount,
  user,
}: {
  signer: ethers.Signer;
  fromToken: string;
  toToken: string;
  amount: string;
  user: string;
}): CallData {
  const aavePool = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
  const iface = new ethers.utils.Interface([
    "function liquidationCall(address,address,address,uint256,bool) external"
  ]);

  const data = iface.encodeFunctionData("liquidationCall", [
    fromToken,        // collateralAsset
    toToken,          // debtAsset
    user,             // user to liquidate
    amount,
    false,            // receiveAToken
  ]);

  return {
    to: aavePool,
    data: data,
    dex: "uniswapv3",
    requiresApproval: true,
    approvalToken: fromToken,
    approvalAmount: ethers.BigNumber.from(amount),
    target: aavePool,  // for compatibility
    callData: data     // for compatibility
  };
}

//Compound
export function buildCompoundLiquidation({
  signer,
  borrower,
  cTokenCollateral,
  cTokenBorrowed,
  amount,
}: {
  signer: ethers.Signer;
  borrower: string;
  cTokenCollateral: string;
  cTokenBorrowed: string;
  amount: string;
}): CallData {
  const compoundPool = "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1";
  const iface = new ethers.utils.Interface([
    "function liquidateBorrow(address borrower, uint repayAmount, address cTokenCollateral) external"
  ]);

  const data = iface.encodeFunctionData("liquidateBorrow", [
    borrower,
    amount,
    cTokenCollateral,
  ]);

  return {
    to: compoundPool,
    data: data,
    dex: "uniswapv3",
    requiresApproval: true,
    approvalToken: cTokenBorrowed,
    approvalAmount: ethers.BigNumber.from(amount),
    target: compoundPool,  // for compatibility
    callData: data     // for compatibility
  };
}

export function buildMorphoLiquidation({
  signer,
  fromToken,
  toToken,
  amount,
  marketParams,
  borrower,
}: {
  signer: ethers.Signer;
  fromToken: string;
  toToken: string;
  amount: string;
  marketParams: any; // pode ser MarketParams do Morpho Blue
  borrower: string;
}): CallData {
  const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  const iface = new ethers.utils.Interface([
    "function liquidate((address,address,uint24,bytes32), address, uint256, address) external"
  ]);

  const data = iface.encodeFunctionData("liquidate", [
    marketParams,
    borrower,
    amount,
    fromToken,
  ]);

  return {
    to: morphoBlue,
    data: data,
    dex: "uniswapv3",
    requiresApproval: true,
    approvalToken: fromToken,
    approvalAmount: ethers.BigNumber.from(amount),
    target: morphoBlue,  // for compatibility
    callData: data     // for compatibility
  };
}

export function buildSparkLiquidation({
  signer,
  fromToken,
  toToken,
  amount,
  user,
}: {
  signer: ethers.Signer;
  fromToken: string;
  toToken: string;
  amount: string;
  user: string;
}): CallData {
  const sparkPool = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  const iface = new ethers.utils.Interface([
    "function liquidationCall(address,address,address,uint256,bool) external"
  ]);

  const data = iface.encodeFunctionData("liquidationCall", [
    fromToken,
    toToken,
    user,
    amount,
    false,
  ]);

  return {
    to: sparkPool,
    data: data,
    dex: "uniswapv3",
    requiresApproval: true,
    approvalToken: fromToken,
    approvalAmount: ethers.BigNumber.from(amount),
    target: sparkPool,  // for compatibility
    callData: data     // for compatibility
  };
}

export function buildVenusLiquidation({
  signer,
  borrower,
  vTokenCollateral,
  vTokenBorrowed,
  amount,
}: {
  signer: ethers.Signer;
  borrower: string;
  vTokenCollateral: string;
  vTokenBorrowed: string;
  amount: string;
}): CallData {
  const venusPool = "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1";
  const iface = new ethers.utils.Interface([
    "function liquidateBorrow(address borrower, uint repayAmount, address vTokenCollateral) external"
  ]);

  const data = iface.encodeFunctionData("liquidateBorrow", [
    borrower,
    amount,
    vTokenCollateral,
  ]);

  return {
    to: venusPool,
    data: data,
    dex: "uniswapv3",
    requiresApproval: true,
    approvalToken: vTokenBorrowed,
    approvalAmount: ethers.BigNumber.from(amount),
    target: venusPool,  // for compatibility
    callData: data     // for compatibility
  };
}
