import { BigNumber } from "ethers";
import { ethers } from "ethers";

export function encodePayMiner(
  contractAddress: string,
  tokenAddress: string,
  amount: bigint
): {
  to: string;
  data: string;
  value: bigint;
} {
  const abi = [
    "function payMiner(address token, uint256 amount) external payable",
  ];

  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData("payMiner", [tokenAddress, amount]);

  const value = tokenAddress.toLowerCase() === ethers.constants.AddressZero.toLowerCase()
    ? amount
    : 0n;

  return {
    to: "0xebc996030ad65e113ba2f03e55de080044b83dca",
    data,
    value,
  };
}