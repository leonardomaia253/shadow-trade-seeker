
import { ethers, BigNumber } from "ethers";
import { DexType, DecodedSwapTransaction } from "./types";
import { enhancedLogger } from "./enhancedLogger";

// ABI fragments for decoding swap methods
const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)",
  "function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)",
  "function swapETHForExactTokens(uint amountOut, address[] path, address to, uint deadline) external payable returns (uint[] amounts)"
];

const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
  "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)"
];

const CURVE_ROUTER_ABI = [
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external",
];

const MAVERICK_V2_ROUTER_ABI = [
  "function swapExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

const UNISWAP_V4_ROUTER_ABI = [
  "function swapExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

// Router addresses for identifying DEXs
const DEX_ROUTERS = {
  uniswapv2: ["0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"].map(a => a.toLowerCase()),
  uniswapv3: ["0xE592427A0AEce92De3Edee1F18E0157C05861564", "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"].map(a => a.toLowerCase()),
  sushiswapv2: ["0xA7caC4207579A179c1069435d032ee0F9F150e5c"].map(a => a.toLowerCase()),
  sushiswapv3: ["0xA7caC4207579A179c1069435d032ee0F9F150e5c"].map(a => a.toLowerCase()),
  camelot: ["0xc873fEcbd354f5A56E00E710B90EF4201db2448d", "0x6EeE6060f715257b970700bc2656De21dEdF074C"].map(a => a.toLowerCase()),
  pancakeswapv3: ["0x13f4ea83d0bd40e75c8222255bc855a974568dd4"].map(a => a.toLowerCase()),
  ramsesv2: ["0xaa273216cc9201a1e4285ca623f584badc736944"].map(a => a.toLowerCase()),
  maverickv2:["0x5c3b380e5Aeec389d1014Da3Eb372FA2C9e0fc76"].map(a => a.toLowerCase()),
  curve:["0x2191718cd32d02b8e60badffea33e4b5dd9a0a0d"].map(a => a.toLowerCase()),
  uniswapv4:["0x2191718cd32d02b8e60badffea33e4b5dd9a0a0d"].map(a => a.toLowerCase()),
};



/**
 * Decodes swap transactions from popular DEXes
 * @param tx Transaction object from ethers
 * @returns Decoded swap parameters or null if not a swap
 */
export function decodeSwap(tx: ethers.providers.TransactionResponse): DecodedSwapTransaction | null {
  try {
    // Skip if no data or value is missing
    if (!tx.data || !tx.to) return null;
    
    const lowercaseTo = tx.to.toLowerCase();

    // Try to identify the DEX based on the router address
    let dexType: DexType | null = null;
    for (const [key, addresses] of Object.entries(DEX_ROUTERS)) {
      if (addresses.includes(lowercaseTo)) {
        dexType = key.toLowerCase() as DexType;
        break;
      }
    }
    
    // If we couldn't identify the DEX, bail out
    if (!dexType) return null;
    
    // Create the appropriate interface for parsing
    let iface: ethers.utils.Interface;
    
    if (dexType.includes('uniswapv2')) {
      iface = new ethers.utils.Interface(UNISWAP_V2_ROUTER_ABI);
    } else if (dexType.includes('sushiswapv2')) {
      iface = new ethers.utils.Interface(UNISWAP_V2_ROUTER_ABI);
    } else if (dexType.includes('camelot')) {
      iface = new ethers.utils.Interface(UNISWAP_V2_ROUTER_ABI);
    } else if (dexType.includes('uniswapv3')) {
      iface = new ethers.utils.Interface(UNISWAP_V3_ROUTER_ABI);
    } else if (dexType.includes('sushiswapv3')) {
      iface = new ethers.utils.Interface(UNISWAP_V3_ROUTER_ABI);
    } else if (dexType.includes('pancakeswapv3')) {
      iface = new ethers.utils.Interface(UNISWAP_V3_ROUTER_ABI);
    } else if (dexType.includes('ramsesv2')) {
      iface = new ethers.utils.Interface(UNISWAP_V3_ROUTER_ABI);
    } else if (dexType.includes('maverickv2')) {
      iface = new ethers.utils.Interface(MAVERICK_V2_ROUTER_ABI);
    } else if (dexType.includes('curve')) {
      iface = new ethers.utils.Interface(CURVE_ROUTER_ABI);
    } else if (dexType.includes('uniswapv4')) {
      iface = new ethers.utils.Interface(UNISWAP_V4_ROUTER_ABI);
    } else {
      return null; // Unsupported DEX type
    }
    
    // Try to decode the transaction
    let decodedData;
    try {
      decodedData = iface.parseTransaction({ data: tx.data });
    } catch (e) {
      // Not a swap transaction we can decode
      return null;
    }
    
    if (!decodedData) return null;
    
    const functionName = decodedData.name;
    const args = decodedData.args;
    
    // Handle different router types and methods  
    switch (dexType) {
  case "uniswapv2":
  case "sushiswapv2":
  case "camelot":
    return decodeV2Swap(functionName, args, dexType, tx.value);
    
  case "uniswapv3":
  case "sushiswapv3":
  case "pancakeswapv3":
  case "ramsesv2": 
    return decodeV3Swap(functionName, args, dexType, tx.value);
    
  case "uniswapv4":
    return decodeUniswapV4Swap(functionName, args, dexType, tx.value);
    
  case "maverickv2":
    return decodeMaverickV2Swap(functionName, args, dexType, tx.value);
    
  case "curve":
    return decodeCurveSwap(functionName, args, dexType, tx.value, tx.to);
    
  default:
    return null;
}
  } catch (err) {
    enhancedLogger.error(`Error decoding swap: ${err}`, {
      botType: "scanner"
    });
    return null;
  }
}

/**
 * Decode Uniswap V2-style router transactions
 */
function decodeV2Swap(
  functionName: string,
  args: ethers.utils.Result,
  dexType: DexType,
  value: ethers.BigNumber
): DecodedSwapTransaction | null {
  try {
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum
    
    // Handle different swap functions
    switch (functionName) {
      case "swapExactTokensForTokens": {
        const [amountIn, amountOutMin, path, to] = args;
        return {
          tokenIn: path[0],
          tokenOut: path[path.length - 1],
          amountIn,
          amountOutMin,
          path,
          recipient:to,
          deadline: args[4],
          dex: dexType
        };
      }
      
      case "swapTokensForExactTokens": {
        const [amountOut, amountInMax, path, to] = args;
        return {
          tokenIn: path[0],
          tokenOut: path[path.length - 1],
          amountIn: amountInMax, // max amount in
          amountOutMin: amountOut, // exact amount out
          path,
          recipient:to,
          deadline: args[4],
          dex: dexType
        };
      }
      
      case "swapExactETHForTokens": {
        const [amountOutMin, path, to] = args;
        return {
          tokenIn: WETH,
          tokenOut: path[path.length - 1],
          amountIn: value, // ETH value sent with tx
          amountOutMin,
          path: [WETH, ...path.slice(1)], // Path should start with WETH
          recipient: to,
          deadline: args[3],
          dex: dexType
        };
      }
      
      case "swapExactTokensForETH": {
        const [amountIn, amountOutMin, path, to] = args;
        return {
          tokenIn: path[0],
          tokenOut: WETH,
          amountIn,
          amountOutMin,
          path: [...path.slice(0, -1), WETH], // Path should end with WETH
          recipient: to, 
          deadline: args[4],
          dex: dexType
        };
      }
      
      // Add other cases as needed
      
      default:
        return null;
    }
  } catch (err) {
    enhancedLogger.error(`Error decoding V2 swap: ${err}`, {
      botType: "scanner"
    });
    return null;
  }
}

/**
 * Decode Uniswap V3-style router transactions
 */
function decodeV3Swap(
  functionName: string,
  args: ethers.utils.Result,
  dexType: DexType,
  value: ethers.BigNumber
): DecodedSwapTransaction | null {
  try {
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum
    
    // Handle different swap functions
    switch (functionName) {
      case "exactInputSingle": {
        const {
          tokenIn,
          tokenOut,
          amountIn,
          amountOutMinimum,
          recipient
        } = args[0];
        
        return {
          tokenIn,
          tokenOut,
          amountIn: tokenIn.toLowerCase() === WETH.toLowerCase() && value.gt(0) ? value : amountIn,
          amountOutMin: amountOutMinimum,
          recipient: recipient,
          dex: dexType,
        };
      }
      
      case "exactInput": {
        const {
          path: pathBytes,
          amountIn,
          amountOutMinimum,
          recipient
        } = args[0];
        
        // Decode path from bytes in V3
        const path = decodeV3Path(pathBytes);
        if (!path || path.length < 2) return null;
        
        return {
          tokenIn: path[0].token,
          tokenOut: path[path.length - 1].token,
          amountIn: path[0].token.toLowerCase() === WETH.toLowerCase() && value.gt(0) ? value : amountIn,
          amountOutMin: amountOutMinimum,
          recipient: recipient,
          dex:dexType
        };
      }
      
      // Add other cases as needed
      
      default:
        return null;
    }
  } catch (err) {
    enhancedLogger.error(`Error decoding V3 swap: ${err}`, {
      botType: "scanner"
    });
    return null;
  }
}


export function decodeCurveSwap(
    functionName: string,
    args: any[],
    dexType: DexType,
    value: BigNumber,
    txFrom: string = ""
): DecodedSwapTransaction | null {
  try {
    if (functionName === "exchange" || functionName === "exchange_underlying") {
      const i = args[0];
      const j = args[1];
      const dx = args[2];
      const minDy = args[3];

      return {
        tokenIn: i,
        tokenOut: j,
        amountIn: dx,
        amountOutMin: minDy,
        dex: dexType,
        recipient: txFrom,
      };
    }

    if (functionName === "exchange_multiple") {
      const routes = args[0];
      const swapParams = args[1];
      const amountIn = args[2];
      const minAmountOut = args[3];

      return {
        tokenIn: routes[0],
        tokenOut: routes[routes.length - 1],
        amountIn,
        amountOutMin: minAmountOut,
        dex: dexType,
        recipient: txFrom,
      };
    }

    return null;
  } catch (err) {
    console.error("Curve decode error:", err);
    return null;
  }
}

export function decodeMaverickV2Swap(
  functionName: string,
  args: any[],
  dexType: DexType,
  value: BigNumber
): DecodedSwapTransaction | null {
  try {
    if (functionName === "exactInputSingle") {
      const params = args[0];

      return {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        amountOutMin: params.amountOutMinimum,
        recipient: params.recipient,
        dex: dexType,
      };
    }

    if (functionName === "exactInput") {
      const params = args[0];
      const { tokenIn, tokenOut } = decodeMaverickPath(params.path);

      return {
        tokenIn,
        tokenOut,
        amountIn: params.amountIn,
        amountOutMin: params.amountOutMinimum,
        recipient: params.recipient,
        dex: dexType,
      };
    }

    return null;
  } catch (err) {
    console.error("MaverickV2 decode error:", err);
    return null;
  }
}

export function decodeUniswapV4Swap(
  functionName: string,
  args: any[],
  dexType: DexType,
  value: BigNumber
): DecodedSwapTransaction | null {
  try {
    if (functionName !== "execute") return null;

    const commands = args[0];
    const inputs = args[1];

    // Procuramos comandos do tipo "Swap"
    for (let i = 0; i < commands.length; i++) {
      const commandType = commands[i]; // geralmente um enum ou uint8 (ex: 0x02 para swap)

      if (commandType === 0x02 || commandType === "2") {
        // Esse é um swap — decodificamos o input correspondente
        const swapInput = inputs[i];

        const decoded = decodeSwapCommandInput(swapInput);

        return {
          tokenIn: decoded.tokenIn,
          tokenOut: decoded.tokenOut,
          amountIn: decoded.amountIn,
          amountOutMin: decoded.amountOutMin,
          recipient: decoded.recipient,
          dex: dexType,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("UniswapV4 decode error:", err);
    return null;
  }
}

/**
 * Helper to decode UniswapV3 path bytes
 */
function decodeV3Path(pathBytes: string): { token: string, fee: number }[] | null {
  try {
    if (!pathBytes || pathBytes.length < 40) return null;
    
    const result = [];
    let position = 2; // skip 0x
    
    // First token
    let token = '0x' + pathBytes.substr(position, 40);
    position += 40;
    
    while (position + 6 < pathBytes.length) {
      // Read fee
      const fee = parseInt(pathBytes.substr(position, 6), 16);
      position += 6;
      
      // Add previous token with its outgoing fee
      result.push({ token, fee });
      
      // Read next token if we have enough bytes left
      if (position + 40 <= pathBytes.length) {
        token = '0x' + pathBytes.substr(position, 40);
        position += 40;
      }
    }
    
    // Add final token (without outgoing fee)
    result.push({ token, fee: 0 });
    
    return result;
  } catch (err) {
    enhancedLogger.error(`Error decoding V3 path: ${err}`, {
      botType: "scanner"
    });
    return null;
  }
}

function decodeMaverickPath(path: string): { tokenIn: string; tokenOut: string } {
  if (!path || path.length < 86) throw new Error("Invalid path");

  // token = 20 bytes (40 hex chars), fee = 3 bytes (6 hex chars)
  const stepSize = 40 + 6; // 46

  const tokenIn = "0x" + path.slice(2, 42);

  const hops = Math.floor((path.length - 2) / stepSize);
  const tokenOutStart = 2 + (stepSize * (hops - 1)) + 46;
  const tokenOut = "0x" + path.slice(tokenOutStart, tokenOutStart + 40);

  return { tokenIn, tokenOut };
}

function decodeSwapCommandInput(swapInput: string): {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  amountOutMin: BigNumber;
  recipient: string;
} {
  const abiCoder = new ethers.utils.AbiCoder();

  const [tokenIn, tokenOut, amountIn, amountOutMin, recipient] = abiCoder.decode(
    ["address", "address", "uint256", "uint256", "address"],
    swapInput
  );

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMin,
    recipient,
  };
}