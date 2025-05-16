
import { ethers } from "ethers";
import { CallData } from "../../utils/types";

// Constrói uma call para flashloan que executa uma sequência de operações
export async function buildOrchestrateCall({
  token,
  amount,
  calls,
}: {
  token: string;
  amount: ethers.BigNumberish;
  calls: CallData[];
}): Promise<{ 
target: string;
data: string;
requiresApproval: boolean;
approvalToken: string;
approvalAmount: number;
to: string;
callData: string;
dex: "uniswapv3";
}> {
  const executorAddress = "";
  const iface = new ethers.utils.Interface([
    "function orchestrate((address provider, address token, uint256 amount)[],(address target, bytes data, bool requiresApproval, address approvalToken, uint256 approvalAmount)[])"
  ]);

  const flashLoanRequest = [{
    provider: "0xE0dB1bE70bCc4D58F00184F9371b6fC0FbB1dfC5", // AAVE
    token,
    amount,
  }];

  const calldata = iface.encodeFunctionData("orchestrate", [flashLoanRequest, calls]);

  return {
    target: executorAddress,
    to: executorAddress,
    data: calldata,
    callData: calldata,
    requiresApproval: false,
    approvalToken: ethers.constants.AddressZero,
    approvalAmount: 0,
    dex: "uniswapv3"
  };
}
