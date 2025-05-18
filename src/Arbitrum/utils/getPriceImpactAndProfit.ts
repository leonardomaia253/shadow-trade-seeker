import { ethers, BigNumber } from "ethers";
import { TransactionDescription } from "ethers/lib/utils";

// ABIs simplificados (apenas métodos relevantes)
const routerV2Abi = [
  "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] calldata path,address to,uint deadline) returns (uint[] memory amounts)",
  // Outros métodos podem ser adicionados conforme necessário
];

const routerV3Abi = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)",
  "function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) returns (uint256 amountIn)",
  // Outros métodos podem ser adicionados conforme necessário
];

const quoterV3Abi = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) view returns (uint256 amountOut)",
  "function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) view returns (uint256 amountIn)",
];

let cachedGasPrice: BigNumber | null = null;
let lastFetchTimestamp = 0;
const GAS_PRICE_TTL = 15 * 1000; // 15 segundos em ms

async function getCachedGasPrice(provider: ethers.providers.Provider): Promise<BigNumber> {
  const now = Date.now();

  if (!cachedGasPrice || now - lastFetchTimestamp > GAS_PRICE_TTL) {
    cachedGasPrice = await provider.getGasPrice();
    lastFetchTimestamp = now;
  }

  return cachedGasPrice;
}


// Helper para decodificar path multi-hop V3
function decodePath(path: string) {
  // path é hex string "tokenA(20) + fee(3) + tokenB(20) + fee(3) + tokenC(20)..."
  // Fee é uint24 (3 bytes)
  const FEE_SIZE = 3;
  const ADDRESS_SIZE = 20;
  const pathBuffer = Buffer.from(path.replace(/^0x/, ""), "hex");

  const hops = [];
  let offset = 0;
  while (offset < pathBuffer.length - ADDRESS_SIZE) {
    const tokenIn = "0x" + pathBuffer.slice(offset, offset + ADDRESS_SIZE).toString("hex");
    offset += ADDRESS_SIZE;
    if (offset + FEE_SIZE > pathBuffer.length) break; // último token
    const fee = pathBuffer.readUIntBE(offset, FEE_SIZE);
    offset += FEE_SIZE;
    hops.push({ tokenIn, fee });
  }
  // tokenOut é último token no path
  const tokenOut = "0x" + pathBuffer.slice(pathBuffer.length - ADDRESS_SIZE).toString("hex");

  return { hops, tokenOut };
}

// Cache simples para txs processadas
const processedTxCache = new Set<string>();

// Métodos que consideramos para swaps (V2 e V3)
const swapMethods = [
  "swapExactTokensForTokens",
  "swapTokensForExactTokens",
  "swapExactETHForTokens",
  "swapETHForExactTokens",
  "swapExactTokensForETH",
  "swapTokensForExactETH",
  "swapExactTokensForTokensSupportingFeeOnTransferTokens",
  "swapExactETHForTokensSupportingFeeOnTransferTokens",
  "swapExactTokensForETHSupportingFeeOnTransferTokens",
  "exactInput",
  "exactInputSingle",
  "exactOutput",
  "exactOutputSingle",
  "multicall",
];

// Interface de retorno
interface PriceImpactProfit {
  priceImpact: number;   // em porcentagem (ex: 0.5 = 0.5%)
  estimatedProfit: BigNumber; // lucro líquido estimado em ETH
}

// Inicialização ethers (RPC público Exemplo)
const provider = new ethers.providers.JsonRpcProvider("http://arb-mainnet.g.alchemy.com/v2/o--1ruggGezl5R36rrSDX8JiVouHQOJO");

// Endereços dos contratos (exemplos - substitua pelos reais)
const routerV2Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const routerV3Address = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const quoterV3Address = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";


// Instancia contratos ethers.js
const routerV2Contract = new ethers.Contract(routerV2Address, routerV2Abi, provider);
const routerV3Contract = new ethers.Contract(routerV3Address, routerV3Abi, provider);
const quoterV3Contract = new ethers.Contract(quoterV3Address, quoterV3Abi, provider);

const ifaceV2 = new ethers.utils.Interface(routerV2Abi);
const ifaceV3 = new ethers.utils.Interface(routerV3Abi);



// Função para decodificar a tx com base na ABI (tenta V2 e V3)
function decodeTransaction(data: string): TransactionDescription | null {
  try {
    return ifaceV2.parseTransaction({ data });
  } catch {
    try {
      return ifaceV3.parseTransaction({ data });
    } catch {
      return null;
    }
  }
}

// Função principal
const cacheGetAmountsOut = new Map<string, BigNumber[]>();
const cacheQuoteExactInputSingle = new Map<string, BigNumber>();

// Limitação simples: espera mínima entre chamadas
const MIN_CALL_INTERVAL_MS = 200; // 5 chamadas por segundo máximo
let lastCallTimestamp = 0;

async function throttle() {
  const now = Date.now();
  const waitTime = MIN_CALL_INTERVAL_MS - (now - lastCallTimestamp);
  if (waitTime > 0) {
    await new Promise((r) => setTimeout(r, waitTime));
  }
  lastCallTimestamp = Date.now();
}

function cacheKeyGetAmountsOut(amountIn: BigNumber, path: string[]) {
  return amountIn.toString() + "-" + path.join("-");
}

function cacheKeyQuoteExactInputSingle(params: any) {
  // Chave única para cache baseada nos params relevantes
  return [
    params.tokenIn,
    params.tokenOut,
    params.fee,
    params.amountIn.toString(),
    params.sqrtPriceLimitX96 ?? "0",
  ].join("-");
}

export async function getPriceImpactAndProfit(
  tx: ethers.providers.TransactionResponse
): Promise<PriceImpactProfit | null> {
  if (processedTxCache.has(tx.hash)) return null;
  processedTxCache.add(tx.hash);

  const decoded = decodeTransaction(tx.data);
  if (!decoded) return null;

  const methodName = decoded.name;
  if (!swapMethods.includes(methodName)) return null;

  try {
    const gasPrice = tx.gasPrice ?? (await getCachedGasPrice(provider));
    const gasLimit = tx.gasLimit ?? BigNumber.from(200000);
    const gasCost = gasPrice.mul(gasLimit);

    if (
      methodName.startsWith("swapExactTokensFor") ||
      methodName.startsWith("swapTokensForExact") ||
      methodName.startsWith("swapExactETHFor") ||
      methodName.startsWith("swapETHForExact")
    ) {
      const args = decoded.args;
      let amountIn: BigNumber;
      let amountOutMin: BigNumber;
      let path: string[];

      if (
        methodName.includes("ExactTokensForTokens") ||
        methodName.includes("ExactETHForTokens") ||
        methodName.includes("ExactTokensForETH")
      ) {
        amountIn = args[0];
        amountOutMin = args[1];
        path = args[2];
      } else if (
        methodName.includes("TokensForExactTokens") ||
        methodName.includes("ETHForExactTokens") ||
        methodName.includes("TokensForExactETH")
      ) {
        amountOutMin = args[0];
        amountIn = args[1];
        path = args[2];
      } else {
        return null;
      }

      const key = cacheKeyGetAmountsOut(amountIn, path);
      let amountsOut = cacheGetAmountsOut.get(key);

      if (!amountsOut) {
        await throttle(); // Limita taxa
        amountsOut = await routerV2Contract.getAmountsOut(amountIn, path);
        cacheGetAmountsOut.set(key, amountsOut);
      }

      const expectedAmountOut = amountsOut[amountsOut.length - 1];

      const priceImpact = Math.max(
        expectedAmountOut
          .sub(amountOutMin)
          .mul(10000)
          .div(expectedAmountOut)
          .toNumber() / 100,
        0
      );

      const estimatedProfit = expectedAmountOut.sub(amountOutMin).sub(gasCost.mul(1.25));

      return { priceImpact, estimatedProfit };
    }

    if (["exactInputSingle", "exactOutputSingle"].includes(methodName)) {
      const params = decoded.args[0];

      if (methodName === "exactInputSingle") {
        const key = cacheKeyQuoteExactInputSingle(params);
        let amountOutQuoted = cacheQuoteExactInputSingle.get(key);

        if (!amountOutQuoted) {
          await throttle();
          amountOutQuoted = await quoterV3Contract.callStatic.quoteExactInputSingle(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.amountIn,
            params.sqrtPriceLimitX96 ?? 0
          );
          cacheQuoteExactInputSingle.set(key, amountOutQuoted);
        }

        const priceImpact = Math.max(
          amountOutQuoted
            .sub(params.amountOutMinimum)
            .mul(10000)
            .div(amountOutQuoted)
            .toNumber() / 100,
          0
        );

        const estimatedProfit = amountOutQuoted.sub(params.amountOutMinimum).sub(gasCost.mul(1.25));
;

        return { priceImpact, estimatedProfit };
      }

      if (methodName === "exactOutputSingle") {
        // Similar, mas por enquanto sem cache pois parâmetros são diferentes (se quiser podemos adaptar)
        await throttle();
        const amountInQuoted: BigNumber = await quoterV3Contract.callStatic.quoteExactOutputSingle(
          params.tokenIn,
          params.tokenOut,
          params.fee,
          params.amountOut,
          params.sqrtPriceLimitX96 ?? 0
        );

        const priceImpact = Math.max(
          amountInQuoted
            .sub(params.amountInMaximum)
            .mul(10000)
            .div(amountInQuoted)
            .toNumber() / 100,
          0
        );

        const estimatedProfit = amountInQuoted.sub(params.amountInMaximum).sub(gasCost.mul(1.25));
;

        return { priceImpact, estimatedProfit };
      }
    }

    return null;
  } catch (error) {
    console.error("Erro no cálculo price impact e profit:", error);
    return null;
  }
}

