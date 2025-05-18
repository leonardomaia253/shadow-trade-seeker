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
  data: string;
  to: string;
}> {
  const executorAddress = "0xebc996030ad65e113ba2f03e55de080044b83dca";
  
  const iface = new ethers.utils.Interface([
    "function orchestrate((address provider, address token, uint256 amount)[],(address target, bytes data, bool requiresApproval, address approvalToken, uint256 approvalAmount)[])"
  ]);

  // Definindo o flashloan (exemplo com Aave como provider)
  const flashloan = [{
    provider: "0xC4dCB5126a3AfEd129BC3668Ea19285A9f56D15D", // Endereço real do provider, ex: Aave pool
    token: token,
    amount: amount
  }];

  const data = iface.encodeFunctionData("orchestrate", [flashloan, calls]);

  return {
    to: executorAddress,
    data: data,
  };
}
