import { ethers } from "ethers";
import {Call} from "../../utils/types";

// ABI mínima de um token ERC20
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

export function buildApproveCall(token: string, spender: string, amount?: string): Call {
  const iface = new ethers.utils.Interface(ERC20_ABI);
  const approveAmount = amount ?? ethers.constants.MaxUint256.toString();
  const data = iface.encodeFunctionData("approve", [spender, approveAmount]);

  return {
    to: token,
    value: 0n,
    data,
  };
}
