import { ethers, BigNumber } from "ethers";
import { getDefaultSigner } from "./../bots/frontrun/frontrunwatcher";
import { DEX_ROUTER, DEX_TYPE } from "../constants/addresses";
import { UNISWAP_V2_ROUTER_ABI, UNISWAP_V3_ROUTER_ABI, ERC20_ABI } from "../constants/abis";
import { getCurveQuote } from "../shared/quoter/curve";
import { getV3Quote } from "../shared/quoter/uniswapv3";
import { getMaverickQuote } from "../shared/quoter/maverick";
import { enhancedLogger as log } from "./enhancedLogger";

// Lista estática de tokens Aave para flashloan
const AAVE_FLASHLOAN_TOKENS = [
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
];

type Params = {
  dex: string;            // nome da DEX (UniswapV2, Curve, etc)
  tokenIn: string;        // token que o swap quer receber
  amountIn: BigNumber;    // quantidade que precisa desse token
  slippageBps?: number;   // slippage opcional em basis points (default: 100 = 1%)
};

export async function selectFlashloanToken({
  dex,
  tokenIn,
  amountIn,
  slippageBps = 100, // 1% por padrão
}: Params): Promise<{ flashLoanToken: string; flashLoanAmount: BigNumber } | null> {
  try {
    const signer = getDefaultSigner();
    const routerAddress = DEX_ROUTER[dex];
    const dexType = DEX_TYPE[dex];

    if (!routerAddress || !dexType) {
      log.warn(`❌ DEX ${dex} não suportada`);
      return null;
    }

    const tokenInLower = tokenIn.toLowerCase();
    const aaveTokensLower = AAVE_FLASHLOAN_TOKENS.map(t => t.toLowerCase());

    // 1. Se o tokenIn já é suportado para flashloan, retorna direto
    if (aaveTokensLower.includes(tokenInLower)) {
      const flashLoanAmount = amountIn.mul(10000 + slippageBps).div(10000);
      return { flashLoanToken: tokenIn, flashLoanAmount };
    }

    const quoteCache = new Map<string, BigNumber>();
    let bestToken: string | null = null;
    let bestAmountIn: BigNumber | null = null;

    for (const candidate of AAVE_FLASHLOAN_TOKENS) {
      try {
        const cacheKey = `${candidate}-${tokenIn}-${dex}`;
        if (quoteCache.has(cacheKey)) {
          continue; // já cotado
        }

        let quote: BigNumber;

        switch (dexType) {
            case "camelot":
            case "uniswapv2":
            case "sushiswapv2":
            const router = new ethers.Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, signer);
            const path = [candidate, tokenIn];
            quote = (await router.getAmountsIn(amountIn, path))[0];
            break;

          case "pancakeswapv3":
          case "sushiswapv3":
          case "ramsesv2":
          case "uniswapv4":
            
            quote = await getV3Quote(routerAddress, candidate, tokenIn, amountIn, signer);
            break;

          case "curve":
            quote = await getCurveQuote(routerAddress, candidate, tokenIn, amountIn, signer);
            break;

          case "maverick":
            quote = await getMaverickQuote(routerAddress, candidate, tokenIn, amountIn, signer);
            break;

          default:
            log.warn(`⚠️ DEX ${dex} com tipo ${dexType} ainda não implementada`);
            continue;
        }

        quoteCache.set(cacheKey, quote);

        if (!bestAmountIn || quote.lt(bestAmountIn)) {
          bestToken = candidate;
          bestAmountIn = quote;
        }

      } catch (err) {
        log.warn(`Falha ao cotar rota de ${candidate} → ${tokenIn} via ${dex}: ${err}`);
        continue; // ignora tokens sem rota
      }
    }

    if (!bestToken || !bestAmountIn) {
      log.warn(`❌ Nenhuma rota viável para tokenIn: ${tokenIn}`);
      return null;
    }

    const flashLoanAmount = bestAmountIn.mul(10000 + slippageBps).div(10000);

    log.info(`✅ Melhor token para flashloan: ${bestToken}, valor necessário: ${ethers.utils.formatEther(bestAmountIn)}`);

    return {
      flashLoanToken: bestToken,
      flashLoanAmount,
    };

  } catch (err) {
    log.error(`Erro em selectFlashloanToken: ${err}`);
    return null;
  }
}
