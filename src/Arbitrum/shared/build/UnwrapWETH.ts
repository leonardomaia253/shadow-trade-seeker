import { ethers } from "ethers";

export function buildUnwrapWETHCall({
  amount,
}: {
  amount: ethers.BigNumberish;
}) {
  const iface = new ethers.utils.Interface([
    "function withdraw(uint256 amount)",
  ]);

  return {
    to: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    data: iface.encodeFunctionData("withdraw", [amount]),
    requiresApproval: false,
    approvalToken: ethers.constants.AddressZero,
    approvalAmount: 0,
  };
}
