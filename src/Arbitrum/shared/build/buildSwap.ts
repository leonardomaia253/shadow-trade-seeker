import { ethers } from "ethers";
import { CallData } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { buildUniswapV2Swap,buildUniswapV3Swap,buildUniswapV4Swap,buildSushiswapV2Swap,buildSushiswapV3Swap,buildPancakeswapV3Swap,buildCamelotSwap,buildRamsesV2Swap,buildMaverickV2Swap,buildCurveSwap} from '../../utils/EncodeSwap';

export async function buildSwapTransaction({
  fromToken,
  toToken,
  amount,
  slippage,
  dex 
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
    switch (dex) {
      case "uniswapv2":
        return buildUniswapV2Swap(fromToken, toToken, amount, amountOutMin);
      case "uniswapv3":
        return buildUniswapV3Swap(fromToken, toToken, amount, amountOutMin);
      case "uniswapv4":
        return buildUniswapV4Swap(fromToken, toToken, amount, amountOutMin);
      case "sushiswapv2":
        return buildSushiswapV2Swap(fromToken, toToken, amount, amountOutMin);
      case "sushiswapv3":
        return buildSushiswapV3Swap(fromToken, toToken, amount, amountOutMin);
      case "pancakeswapv3":
        return buildPancakeswapV3Swap(fromToken, toToken, amount, amountOutMin);
      case "camelot":
        return buildCamelotSwap(fromToken, toToken, amount, amountOutMin);
      case "maverickv2":
        return buildMaverickV2Swap(fromToken, toToken, amount, amountOutMin);
      case "ramsesv2":
        return buildRamsesV2Swap(fromToken, toToken, amount, amountOutMin);
      case "curve":
        return buildCurveSwap(fromToken, toToken, amount, amountOutMin);
        
      default:
        // Valor padrão para Uniswap V3
        return buildUniswapV3Swap(fromToken, toToken, amount, amountOutMin);
    }
  } catch (err) {
    enhancedLogger.error(`Error building swap transaction: ${err instanceof Error ? err.message : String(err)}`, {
      data: err
    });
    throw err;
  }
}