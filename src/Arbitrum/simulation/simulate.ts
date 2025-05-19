
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

// Adding the missing simulateTransaction function
export async function simulateTransaction({
  provider,
  to,
  data,
  value = 0,
  from,
}: {
  provider: ethers.providers.Provider;
  to: string;
  data: string;
  value?: number | string;
  from?: string;
}) {
  try {
    // If from is not provided, use a random address
    const fromAddress = from || ethers.Wallet.createRandom().address;
    
    // Execute call
    const result = await provider.call({
      to,
      data,
      value: ethers.utils.parseEther(value.toString()),
      from: fromAddress,
    });
    
    return {
      success: true,
      result,
      gasUsed: ethers.BigNumber.from(0) // In a real simulation we would get actual gas usage
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      reason: parseRevertReason(error)
    };
  }
}

// Helper to parse revert reasons from errors
function parseRevertReason(error: any): string {
  try {
    // Different providers format errors differently
    if (error.data) {
      // Try to decode the error data
      return ethers.utils.toUtf8String(
        `0x${error.data.substring(138)}`
      ).replace(/\u0000/g, '');
    }
    
    if (typeof error.message === 'string' && error.message.includes('reverted with reason string')) {
      const match = error.message.match(/'([^']+)'/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return 'Unknown revert reason';
  } catch {
    return 'Unable to parse revert reason';
  }
}
