import { ethers } from "ethers";
import { CallData } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { buildAaveLiquidation,buildCompoundLiquidation,buildMorphoLiquidation,buildSparkLiquidation,buildVenusLiquidation} from '../../utils/encodeLiquidation';

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
}): Promise<CallData> {
  try {
    // Normalmente faríamos uma consulta para estimar o valor de saída
    // Para simplificar, vamos assumir que o valor de saída é igual (1:1)
    // Em uma implementação real, consultaríamos a API do DEX
    
    // Calcular valor mínimo aceitável considerando slippage
    const amountOutMin = amount.mul(Math.floor((1 - slippage) * 10000)).div(10000);
    
    // Construir a transação de swap com base no DEX
    switch (protocol) {
      case "aave":
        return buildAaveLiquidation(fromToken, toToken, amount, amountOutMin);
      case "compound":
        return buildCompoundLiquidation(fromToken, toToken, amount, amountOutMin);
      case "morpho":
        return buildMorphoLiquidation(fromToken, toToken, amount, amountOutMin);
      case "spark":
        return buildSparkLiquidation(fromToken, toToken, amount, amountOutMin);
      case "venus":
        return buildVenusLiquidation(fromToken, toToken, amount, amountOutMin);
      default:
        // Valor padrão para Uniswap V3
        return buildAaveLiquidation(fromToken, toToken, amount, amountOutMin);
    }
  } catch (err) {
    enhancedLogger.error(`Error building liquidation transaction: ${err instanceof Error ? err.message : String(err)}`, {
      data: err
    });
    throw err;
  }
}