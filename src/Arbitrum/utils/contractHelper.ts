
import { ethers } from "ethers";
import { DexType } from "../utils/types";
import { DEX_ROUTER } from "../constants/addresses";

// ABIs - simplified for demonstration
const UniswapV2RouterABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const UniswapV3RouterABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMin, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

const UniswapV4RouterABI = [
  "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)"
];

const MaverickV2RouterABI = [
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to) external returns (uint256 amountOut)"
];

const CurveRouterABI = [
  "function exchange_multiple(address[9] memory _route, uint256[3][4] memory _swap_params, uint256 _amount, uint256 _expected) external payable returns (uint256)"
];

/**
 * Obtém instância do contrato de router para o DEX especificado
 */
export function getRouterContract(dexType: DexType, provider: ethers.providers.Provider): ethers.Contract {
  const routerAddress = DEX_ROUTER[dexType];
  
  if (!routerAddress) {
    throw new Error(`Endereço do router não encontrado para DEX: ${dexType}`);
  }
  
  // Seleciona o ABI apropriado com base no tipo de DEX
  let routerAbi;
  switch(dexType) {
    case 'uniswapv2':
    case 'camelot':
    case 'sushiswapv2':
      routerAbi = UniswapV2RouterABI;
      break;
      
    case 'uniswapv3':
    case 'pancakeswapv3':
    case 'sushiswapv3':
    case 'ramsesv2':    
      routerAbi = UniswapV3RouterABI;
      break;
      
    case 'curve':
      routerAbi = CurveRouterABI;
      break;
      
    case 'maverickv2':
      routerAbi = MaverickV2RouterABI;
      break;
    case 'uniswapv4':
      routerAbi = UniswapV4RouterABI;
      break;
      
    default:
      throw new Error(`ABI não disponível para DEX: ${dexType}`);
  }
  
  return new ethers.Contract(routerAddress, routerAbi, provider);
}

/**
 * Obtém instância de um token ERC20
 */
export function getERC20Contract(tokenAddress: string, provider: ethers.providers.Provider): ethers.Contract {
  const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
  ];
  
  return new ethers.Contract(tokenAddress, erc20Abi, provider);
}
