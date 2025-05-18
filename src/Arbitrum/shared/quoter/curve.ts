import { BigNumber, ethers } from "ethers";
import { CURVE_POOL_ABI } from "../../constants/abis"; // você precisa incluir um ABI básico de Curve pool

/**
 * Retorna a quantidade necessária de tokenIn para obter amountOut de tokenOut em um pool Curve.
 * Você precisa garantir que o índice correto (i,j) está mapeado.
 */
export async function getCurveQuote(
  poolAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountOut: BigNumber,
  provider: ethers.Signer | ethers.providers.Provider
): Promise<BigNumber> {
  const pool = new ethers.Contract(poolAddress, CURVE_POOL_ABI, provider);

  // Aqui simplificamos o mapeamento do index, mas idealmente ele deve ser dinâmico
  const indexMap = await Promise.all(
    [tokenIn, tokenOut].map(async (token) => {
      for (let i = 0; ; i++) {
        try {
          const t = await pool.coins(i);
          if (t.toLowerCase() === token.toLowerCase()) return i;
        } catch {
          break;
        }
      }
      throw new Error(`Token ${token} não encontrado no pool Curve`);
    })
  );

  const [i, j] = indexMap;

  // Retorna quanto precisa para receber `amountOut` de `j`
  return await pool.get_dy_underlying(i, j, amountOut);
}
