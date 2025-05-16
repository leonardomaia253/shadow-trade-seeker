
import { ethers } from "ethers";
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
    if (dexType.includes('v2')) {
      return decodeV2Swap(functionName, args, dexType, tx.value);
    } else if (dexType.includes('v3')) {
      return decodeV3Swap(functionName, args, dexType, tx.value);
    }
    
    return null;
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
          recipient: to,
          to,
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
          recipient: to,
          to,
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
          to,
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
          to,
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
          recipient,
          to: recipient,
          dex: dexType
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
          recipient,
          to: recipient,
          dex: dexType
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
