
import { ethers } from "ethers";
import { provider } from "../../../config/provider";
import { LENDING_PROTOCOL_ADDRESSES } from "../../../constants/addresses";
import { enhancedLogger } from "../../../utils/enhancedLogger";
import { TokenInfo } from "../../../utils/types";
import { WETH, USDC, USDT, DAI, WBTC, TOKEN_DETAILS } from "../../../constants/tokens";

// Interface para posições de usuários no Aave
export interface AaveUserPosition {
  user: string;
  collateralTokens: TokenInfo[];
  debtTokens: TokenInfo[];
  healthFactor: ethers.BigNumber;
  totalCollateralUSD: ethers.BigNumber;
  totalDebtUSD: ethers.BigNumber;
}

// Interface para oportunidades de liquidação
export interface LiquidationOpportunity {
  user?: string;
  protocol: string;
  collateralToken: TokenInfo;
  debtToken: TokenInfo;
  collateralAmount: ethers.BigNumber;
  debtAmount: ethers.BigNumber;
  healthFactor: number;
  liquidationBonus: number;
}

/**
 * Consulta posições de usuários no Aave V3
 */
export async function queryCompoundPositions(): Promise<AaveUserPosition[]> {
  try {
    const aavePool = LENDING_PROTOCOL_ADDRESSES.AAVE_V3.POOL;
    
    // Interface para consultar eventos de empréstimo e colateral
    const aavePoolInterface = new ethers.utils.Interface([
      "event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)",
      "event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint256 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)"
    ]);
    
    // Filtros para eventos recentes
    const aavePoolContract = new ethers.Contract(
      aavePool,
      aavePoolInterface,
      provider
    );
    
    // Bloco atual menos ~10 dias para filtrar eventos recentes
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 70000; // ~10 dias no Arbitrum
    
    // Buscar eventos de empréstimo e depósito
    const [supplyEvents, borrowEvents] = await Promise.all([
      aavePoolContract.queryFilter(
        aavePoolContract.filters.Supply(),
        fromBlock
      ),
      aavePoolContract.queryFilter(
        aavePoolContract.filters.Borrow(),
        fromBlock
      )
    ]);
    
    enhancedLogger.info(`Found ${supplyEvents.length} supply events and ${borrowEvents.length} borrow events in Aave V3`, {
      botType: "liquidation"
    });
    
    // Mapear usuários únicos
    const users = new Set<string>();
    [...supplyEvents, ...borrowEvents].forEach(event => {
      users.add(event.args?.user.toLowerCase());
      if (event.args?.onBehalfOf) {
        users.add(event.args.onBehalfOf.toLowerCase());
      }
    });
    
    enhancedLogger.info(`Found ${users.size} unique users in Aave V3`, {
      botType: "liquidation"
    });
    
    // Interface para consultar dados de usuários
    const userDataInterface = new ethers.utils.Interface([
      "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
    ]);
    
    const userDataContract = new ethers.Contract(
      aavePool,
      userDataInterface,
      provider
    );
    
    // Consultar dados para um subconjunto de usuários (limitar para não sobrecarregar)
    const userArray = Array.from(users).slice(0, 100);
    
    const positionsPromises = userArray.map(async (user) => {
      try {
        const userData = await userDataContract.getUserAccountData(user);
        
        // Vamos considerar apenas usuários com health factor < 2 para evitar processamento desnecessário
        if (userData.healthFactor.gt(ethers.utils.parseUnits("2", 18))) {
          return null;
        }
        
        // Health factor é retornado com 18 decimais
        const healthFactor = userData.healthFactor;
        
        // Placeholder para tokens (em uma implementação completa, buscaríamos dados específicos)
        const collateralTokens: TokenInfo[] = [];
        const debtTokens: TokenInfo[] = [];
        
        return {
          user,
          collateralTokens,
          debtTokens,
          healthFactor,
          totalCollateralUSD: userData.totalCollateralBase,
          totalDebtUSD: userData.totalDebtBase
        };
      } catch (error) {
        enhancedLogger.debug(`Error fetching data for user ${user}: ${error instanceof Error ? error.message : String(error)}`, {
          botType: "liquidation"
        });
        return null;
      }
    });
    
    const positions = (await Promise.all(positionsPromises)).filter(Boolean) as AaveUserPosition[];
    
    enhancedLogger.info(`Found ${positions.filter(p => p.healthFactor.lt(ethers.utils.parseUnits("1", 18))).length} potentially liquidatable positions in Aave V3`, {
      botType: "liquidation"
    });
    
    return positions;
  } catch (error) {
    enhancedLogger.error(`Error querying Aave positions: ${error instanceof Error ? error.message : String(error)}`, {
      botType: "liquidation"
    });
    return [];
  }
}

/**
 * Identifica oportunidades de liquidação no Aave V3
 * Implementação real que busca dados da blockchain
 */
export async function getCompoundLiquidationOpportunities(): Promise<LiquidationOpportunity[]> {
  try {
    enhancedLogger.info("Fetching Aave liquidation opportunities", {
      botType: "liquidation"
    });
    
    // Inicializar contratos Aave
    const aavePoolAddress = LENDING_PROTOCOL_ADDRESSES.AAVE_V3.POOL;
    const aaveDataProviderAddress = LENDING_PROTOCOL_ADDRESSES.AAVE_V3.DATA_PROVIDER;
    const aaveOracleAddress = LENDING_PROTOCOL_ADDRESSES.AAVE_V3.PRICE_ORACLE;
    
    // ABI mínimo para contratos Aave
    const poolAbi = [
      "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
      "function getReservesList() view returns (address[])"
    ];
    
    const dataProviderAbi = [
      "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
      "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
      "function getReserveConfigurationData(address asset) view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)"
    ];
    
    const priceOracleAbi = [
      "function getAssetPrice(address asset) view returns (uint256)",
      "function getSourceOfAsset(address asset) view returns (address)"
    ];

    // Criar instâncias dos contratos
    const aavePool = new ethers.Contract(aavePoolAddress, poolAbi, provider);
    const aaveDataProvider = new ethers.Contract(aaveDataProviderAddress, dataProviderAbi, provider);
    const aaveOracle = new ethers.Contract(aaveOracleAddress, priceOracleAbi, provider);

    // Obter eventos recentes para encontrar usuários ativos
    const currentBlock = await provider.getBlockNumber();
    const lookbackBlocks = 20000; // Aproximadamente 1 dia no Arbitrum
    const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
    
    // Interface para eventos de empréstimo
    const borrowEventInterface = new ethers.utils.Interface([
      "event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)"
    ]);
    
    // Buscar eventos de empréstimo recentes
    const borrowLogs = await provider.getLogs({
      fromBlock,
      toBlock: "latest",
      address: aavePoolAddress,
      topics: [
        ethers.utils.id("Borrow(address,address,address,uint256,uint8,uint256,uint16)")
      ]
    });
    
    enhancedLogger.info(`Found ${borrowLogs.length} recent Aave borrow events`, {
      botType: "liquidation"
    });
    
    // Extrair endereços de usuários únicos dos eventos de empréstimo
    const userAddresses = new Set<string>();
    
    for (const log of borrowLogs) {
      const parsedLog = borrowEventInterface.parseLog(log);
      if (parsedLog.args.user) {
        userAddresses.add(parsedLog.args.user.toLowerCase());
      }
      if (parsedLog.args.onBehalfOf) {
        userAddresses.add(parsedLog.args.onBehalfOf.toLowerCase());
      }
    }
    
    enhancedLogger.info(`Found ${userAddresses.size} unique user addresses to check`, {
      botType: "liquidation"
    });
    
    // Verificar health factor para cada usuário
    const opportunities: LiquidationOpportunity[] = [];
    const reservesList = await aavePool.getReservesList();
    
    // Cache para dados de configuração de reserva
    const reserveConfigCache = new Map<string, {
      liquidationThreshold: number;
      liquidationBonus: number;
    }>();
    
    // Cache para tokens e suas informações
    const tokenInfoCache = new Map<string, TokenInfo>();
    
    // Processar usuários em lotes para evitar sobrecarga da RPC
    const batchSize = 5;
    const usersArray = Array.from(userAddresses);
    
    for (let i = 0; i < usersArray.length; i += batchSize) {
      const batch = usersArray.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (userAddress) => {
        try {
          // Obter dados da conta do usuário
          const accountData = await aavePool.getUserAccountData(userAddress);
          
          // Verificar se o health factor está abaixo de 1 (liquidável)
          const healthFactor = accountData.healthFactor;
          const healthFactorNumber = parseFloat(ethers.utils.formatUnits(healthFactor, 18));
          
          if (healthFactorNumber >= 1) {
            return; // Não é liquidável, pular
          }
          
          enhancedLogger.debug(`Found liquidatable position: ${userAddress}, health factor: ${healthFactorNumber}`, {
            botType: "liquidation"
          });
          
          // Obter detalhes de colateral e empréstimos do usuário
          let highestCollateral = {
            token: "",
            aTokenBalance: ethers.constants.Zero,
            usdValue: ethers.constants.Zero,
            tokenInfo: null as TokenInfo | null
          };
          
          let highestDebt = {
            token: "",
            debtAmount: ethers.constants.Zero,
            usdValue: ethers.constants.Zero,
            tokenInfo: null as TokenInfo | null
          };
          
          // Verificar todas as reservas para este usuário
          for (const asset of reservesList) {
            try {
              // Obter dados da reserva do usuário
              const userReserveData = await aaveDataProvider.getUserReserveData(asset, userAddress);
              
              // Verifica se há colateral ou dívida nesta reserva
              if (userReserveData.currentATokenBalance.gt(0) || userReserveData.currentVariableDebt.gt(0)) {
                // Obter informações do token do cache ou criar nova entrada
                if (!tokenInfoCache.has(asset)) {
                  // Obter o preço do token
                  const price = await aaveOracle.getAssetPrice(asset);
                  
                  // Determinar símbolo e decimais (na produção, isso seria obtido do contrato ERC20)
                  let symbol = "UNKNOWN";
                  let decimals = 18;
                  
                  // Usar constantes conhecidas para tokens comuns
                  const normalizedAddress = asset.toLowerCase();
                  if (normalizedAddress === WETH.toLowerCase()) {
                    symbol = "WETH";
                    decimals = TOKEN_DETAILS[WETH].decimals;
                  } else if (normalizedAddress === USDC.toLowerCase()) {
                    symbol = "USDC";
                    decimals = TOKEN_DETAILS[USDC].decimals;
                  } else if (normalizedAddress === USDT.toLowerCase()) {
                    symbol = "USDT";
                    decimals = TOKEN_DETAILS[USDT].decimals;
                  } else if (normalizedAddress === DAI.toLowerCase()) {
                    symbol = "DAI";
                    decimals = TOKEN_DETAILS[DAI].decimals;
                  } else if (normalizedAddress === WBTC.toLowerCase()) {
                    symbol = "WBTC";
                    decimals = TOKEN_DETAILS[WBTC].decimals;
                  } else {
                    // Para tokens desconhecidos, tentar obter informações da chain
                    try {
                      const tokenContract = new ethers.Contract(asset, [
                        "function symbol() view returns (string)",
                        "function decimals() view returns (uint8)"
                      ], provider);
                      
                      symbol = await tokenContract.symbol();
                      decimals = await tokenContract.decimals();
                    } catch (tokenError) {
                      enhancedLogger.warn(`Could not fetch token info for ${asset}, using defaults`, {
                        botType: "liquidation"
                      });
                    }
                  }
                  
                  // Criar objeto de informações do token
                  const tokenInfo: TokenInfo = {
                    address: asset,
                    symbol,
                    decimals,
                    price: parseFloat(ethers.utils.formatUnits(price, 8)), // Preço da AAVE vem com 8 decimais
                    toLowerCase: () => asset.toLowerCase()
                  };
                  
                  // Armazenar no cache
                  tokenInfoCache.set(asset, tokenInfo);
                }
                
                const tokenInfo = tokenInfoCache.get(asset)!;
                
                // Verificar se é colateral
                if (userReserveData.currentATokenBalance.gt(0) && userReserveData.usageAsCollateralEnabled) {
                  // Converter para valor em USD
                  const usdValue = userReserveData.currentATokenBalance
                    .mul(ethers.utils.parseUnits(tokenInfo.price.toString(), 8))
                    .div(ethers.BigNumber.from(10).pow(8));
                  
                  // Verificar se é o maior colateral
                  if (highestCollateral.token === "" || usdValue.gt(highestCollateral.usdValue)) {
                    highestCollateral = {
                      token: asset,
                      aTokenBalance: userReserveData.currentATokenBalance,
                      usdValue,
                      tokenInfo
                    };
                  }
                }
                
                // Verificar se há dívida
                if (userReserveData.currentVariableDebt.gt(0)) {
                  // Converter para valor em USD
                  const usdValue = userReserveData.currentVariableDebt
                    .mul(ethers.utils.parseUnits(tokenInfo.price.toString(), 8))
                    .div(ethers.BigNumber.from(10).pow(8));
                  
                  // Verificar se é a maior dívida
                  if (highestDebt.token === "" || usdValue.gt(highestDebt.usdValue)) {
                    highestDebt = {
                      token: asset,
                      debtAmount: userReserveData.currentVariableDebt,
                      usdValue,
                      tokenInfo
                    };
                  }
                }
              }
            } catch (reserveError) {
              enhancedLogger.debug(`Error checking reserve ${asset} for user ${userAddress}: ${reserveError instanceof Error ? reserveError.message : String(reserveError)}`, {
                botType: "liquidation"
              });
              // Continuar com a próxima reserva
            }
          }
          
          // Se encontramos colateral e dívida válidos
          if (highestCollateral.token && highestDebt.token) {
            // Obter bônus de liquidação (se não estiver em cache)
            if (!reserveConfigCache.has(highestCollateral.token)) {
              const reserveConfig = await aaveDataProvider.getReserveConfigurationData(highestCollateral.token);
              reserveConfigCache.set(highestCollateral.token, {
                liquidationThreshold: reserveConfig.liquidationThreshold.toNumber() / 10000, // Convertendo de bps para decimal
                liquidationBonus: reserveConfig.liquidationBonus.toNumber() / 10000 - 1 // Convertendo para formato decimal (ex: 0.05 para 5%)
              });
            }
            
            const reserveConfig = reserveConfigCache.get(highestCollateral.token)!;
            
            // Criar oportunidade de liquidação
            opportunities.push({
              user: userAddress,
              protocol: "aave",
              collateralToken: highestCollateral.tokenInfo!,
              debtToken: highestDebt.tokenInfo!,
              collateralAmount: highestCollateral.aTokenBalance,
              debtAmount: highestDebt.debtAmount,
              healthFactor: healthFactorNumber,
              liquidationBonus: reserveConfig.liquidationBonus
            });
            
            enhancedLogger.info(`Added liquidation opportunity for user ${userAddress} with health factor ${healthFactorNumber}`, {
              botType: "liquidation"
            });
          }
        } catch (userError) {
          enhancedLogger.warn(`Error checking user ${userAddress}: ${userError instanceof Error ? userError.message : String(userError)}`, {
            botType: "liquidation"
          });
        }
      }));
      
      // Pequeno delay entre lotes para não sobrecarregar o nó RPC
      if (i + batchSize < usersArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    enhancedLogger.info(`Found ${opportunities.length} liquidation opportunities in Aave V3`, {
      botType: "liquidation"
    });
    
    return opportunities;
  } catch (error) {
    enhancedLogger.error(`Error getting Aave liquidation opportunities: ${error instanceof Error ? error.message : String(error)}`, {
      botType: "liquidation"
    });
    return [];
  }
}
