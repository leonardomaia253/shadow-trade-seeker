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
  const executor = new ethers.Contract(executorAddress, executorAbi, provider);
  const token = new ethers.Contract(tokenAddress, erc20Abi, provider);

  const iface = new ethers.utils.Interface(executorAbi);
  const calldata = iface.encodeFunctionData("executeWithCollateral", [calls]);

  // Saldo antes da simulação
  const balanceBefore = await token.balanceOf(executorAddress);

  // Simula a execução sem enviar para a rede (off-chain)
  await provider.call({
    to: executorAddress,
    data: calldata,
    from: executorAddress,
  });

  // Saldo após a simulação
  const balanceAfter = await token.balanceOf(executorAddress);

  const profit = balanceAfter.sub(balanceBefore);
  console.log("Simulated token profit:", profit.toString());

  return profit;
}
