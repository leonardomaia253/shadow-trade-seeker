import { ethers } from "ethers";

// ABI reduzida do executor e do ERC20
const executorAbi = [
  "function executeWithCollateral((address target, bytes data, bool requiresApproval, address approvalToken, uint256 approvalAmount)[] calldata calls) external",
];
const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

// Tipo CallData igual ao seu contrato
interface CallData {
  target?: string;
  data?: string;
  requiresApproval?: boolean;
  approvalToken?: string;
  approvalAmount?: ethers.BigNumberish;
}

export async function simulateTokenProfit({
  provider,
  executorAddress,
  tokenAddress,
  calls,
}: {
  provider: ethers.providers.Provider;
  executorAddress: string;
  tokenAddress: string;
  calls: CallData[];
}) {
  const token = new ethers.Contract(tokenAddress, erc20Abi, provider);
  const iface = new ethers.utils.Interface(executorAbi);
  const calldata = iface.encodeFunctionData("executeWithCollateral", [calls]);

  // Chamar em paralelo para ganhar tempo
  const [balanceBefore, callResult] = await Promise.all([
    token.balanceOf(executorAddress),
    provider.call({
      to: executorAddress,
      data: calldata,
      from: executorAddress,
    }),
  ]);

  const balanceAfter = await token.balanceOf(executorAddress);

  const profit = balanceAfter.sub(balanceBefore);

  return profit;
}
