
// Common ABI fragments used across the project

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const EXECUTOR_ABI = [
  "function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes callData) payable returns (uint256)",
  "function executeArbitrage(address[] path, uint256 amountIn, uint256 minAmountOut) payable returns (uint256)",
  "function executeFrontrun(address router, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes data) payable returns (uint256)",
  "function payMinerETH() payable",
  "function payMinerERC20(address token, uint256 amount)",
  "function emergencyWithdraw(address token, uint256 amount) onlyOwner",
  "function withdraw(address token, uint256 amount) onlyOwner"
];

export const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint256 amountIn, address[] memory path) view returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
  "function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] memory amounts)",
  {
    "name": "getAmountsIn",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      { "type": "uint256", "name": "amountOut" },
      { "type": "address[]", "name": "path" }
    ],
    "outputs": [
      { "type": "uint256[]", "name": "amounts" }
    ]
  }
];



export const UNISWAP_V3_QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
  "function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut)"
];

export const CURVE_POOL_ABI = [
    "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)",
    "function get_dy_underlying(int128 i, int128 j, uint256 dx) external view returns (uint256)",
    "function balances(uint256 index) external view returns (uint256)"
];


export const MAVERICK_V2_PAIR_ABI = [
    "function getBin(uint128 binId) external view returns (Bin memory)",
    "function getActiveBins() external view returns (uint128[] memory)",
    "function liquidityMap() external view returns (uint256)"
];

export const MAVERICK_QUOTER_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "tokenIn", "type": "address" },
      { "internalType": "address", "name": "tokenOut", "type": "address" },
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
      { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
    ],
    "name": "quoteExactOutputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];


export const AggregatorV3InterfaceABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
    name: "getRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

