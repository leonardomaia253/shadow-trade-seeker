import { BigNumber } from "ethers";
import { ethers } from "ethers";

export function encodePayMiner(
  contractAddress: string,
  tokenAddress: string,
  amount: bigint
): ethers.providers.TransactionRequest {
  const abi = [
    "function payMiner(address token, uint256 amount) external payable",
  ];

  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData("payMiner", [tokenAddress, amount]);

  const value = tokenAddress.toLowerCase() === ethers.constants.AddressZero.toLowerCase()
    ? amount
    : 0n;

  return {
    to: contractAddress, // em vez de hardcoded
    data,
    value,
    gasLimit: 200_000n, // use valor maior do que 21000 se não for uma tx simples
    maxFeePerGas: ethers.utils.parseUnits("100", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei"),
  };
}
