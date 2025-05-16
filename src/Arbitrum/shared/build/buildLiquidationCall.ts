
import { ethers } from "ethers";
import { CallData } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";

export async function buildLiquidationCall({
  fromToken,
  toToken,
  amount,
  slippage = 0.01,
  protocol = "aave"
}: {
  fromToken: string;
  toToken: string;
  amount: ethers.BigNumber;
  slippage?: number;
  dex?: string;
  protocol?: string;
}): Promise<CallData> {
  try {
    // Normalmente faríamos uma consulta para estimar o valor de saída
    // Para simplificar, vamos assumir que o valor de saída é igual (1:1)
    // Em uma implementação real, consultaríamos a API do DEX
    
    // Calcular valor mínimo aceitável considerando slippage
    const amountOutMin = amount.mul(Math.floor((1 - slippage) * 10000)).div(10000);
    
    // Use protocol-specific adapters or a default implementation
    let target = "";
    let callData = "";
    
    switch (protocol.toLowerCase()) {
      case "aave":
        target = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
        // Basic liquidation call data (simplified)
        callData = "0x00000000"; 
        break;
      case "compound":
        target = "0xbF0Bdd5C73813498D99b9F32BB4C0E84934F0885";
        callData = "0x00000000";
        break;
      case "morpho":
        target = "0x33333333333333333333333333333333";
        callData = "0x00000000";
        break;
      case "spark":
        target = "0x55555555555555555555555555555555";
        callData = "0x00000000";
        break;
      case "venus":
        target = "0x77777777777777777777777777777777";
        callData = "0x00000000";
        break;
      default:
        target = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Default to AAVE
        callData = "0x00000000";
    }
    
    return {
      target,
      to: target,
      callData,
      data: callData,
      dex: "uniswapv3",
      requiresApproval: true,
      approvalToken: fromToken,
      approvalAmount: amount
    };
    
  } catch (err) {
    enhancedLogger.error(`Error building liquidation transaction: ${err instanceof Error ? err.message : String(err)}`, {
      data: err
    });
    throw err;
  }
}
