
import { ethers } from "ethers";
import { DexType } from "../utils/types";
import { DEX_ROUTER } from "../constants/addresses";

// ABIs
import { abi as UniswapV2RouterABI } from "../constants/abis";
import { abi as UniswapV3RouterABI } from "../constants/abis";
import { abi as UniswapV4RouterABI } from "../constants/abis";
import { abi as MaverickV2RouterABI } from "../constants/abis";
import { abi as CurveRouterABI } from "../constants/abis";

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
      routerAbi = MaverickV2RouterABI; // Supondo que usa interface similar
      break;
    case 'uniswapv4':
      routerAbi = UniswapV4RouterABI; // Supondo que usa interface similar
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
