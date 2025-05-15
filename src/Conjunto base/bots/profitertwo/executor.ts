
import { ethers } from "ethers";
import { provider } from "../../config/provider";
import { BuiltRoute } from "../../utils/types";
import { enhancedLogger } from "../../utils/enhancedLogger";
import { simulateAndValidateRoute } from "../../simulation/simulateandvalidateroute";
import { sendBundle } from "../../executor/sendBundle";
import { saveBotTransaction } from "../../db/databaseService";

/**
 * Executa uma arbitragem identificada
 */
export async function executeArbitrage({
  route,
  flashloanToken,
  flashloanAmount,
  minerBribeAmount,
  options = {}
}: {
  route: BuiltRoute;
  flashloanToken: string;
  flashloanAmount: ethers.BigNumber;
  minerBribeAmount?: ethers.BigNumber;
  options?: {
    gasLimit?: number;
    gasPrice?: ethers.BigNumber;
    maxPriorityFeePerGas?: ethers.BigNumber;
    useBundle?: boolean;
    useMevShare?: boolean;
    dryRun?: boolean;
  };
}): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    enhancedLogger.info(`Executing arbitrage with ${route.swaps.length} swaps`, {
      category: "executor",
      botType: "profiter",
      data: {
        profitEstimate: route.expectedProfit.toString(),
        profitUsd: route.profitUsd,
        swaps: route.swaps.map(s => `${s.fromToken} -> ${s.toToken} via ${s.dex}`)
      }
    });
    
    // Simular a rota para validar
    enhancedLogger.debug("Simulating route before execution", {
      category: "executor",
      botType: "profiter"
    });
    
    const { ok, simulationUrl, profits, error: simulationError } = await simulateAndValidateRoute(route, userAddress);
    
    if (!ok) {
      enhancedLogger.error(`Simulation failed: ${simulationError}`, {
        category: "executor",
        botType: "profiter",
        data: { simulationUrl }
      });
      return {
        success: false,
        error: `Simulation failed: ${simulationError}`
      };
    }
    
    enhancedLogger.info(`Simulation successful with estimated profit: ${profits}`, {
      category: "executor",
      botType: "profiter",
      data: { simulationUrl }
    });
    
    // Para execuções em dry run, pare aqui
    if (options.dryRun) {
      enhancedLogger.info("Dry run complete, not executing transaction", {
        category: "executor",
        botType: "profiter"
      });
      return {
        success: true,
        txHash: "dry-run"
      };
    }
    
    // Construir a transação de arbitragem
    enhancedLogger.debug("Building transaction", {
      category: "executor",
      botType: "profiter"
    });
    
    const txs: string[] = [];
    
    // Obter a interface do contrato executor
    const executorContract = new ethers.Contract(
      route.swaps[0].target, // Usando o target do primeiro swap
      [
        "function orchestrate((address provider,address token,uint256 amount)[],(address target,bytes data,bool requiresApproval,address approvalToken,uint256 approvalAmount)[]) external",
        "function payMinerERC20(address token, uint256 amount) external"
      ],
      signer
    );
    
    // Preparar dados para flashloan
    const flashloanRequest = [{
      provider: route.swaps[0].flashloanProvider || "aave_v3", // Fallback para Aave V3
      token: flashloanToken,
      amount: flashloanAmount,
    }];
    
    // Preparar calls de swap
    const calls = route.swaps.map(swap => ({
      target: swap.target,
      data: swap.callData,
      requiresApproval: true,
      approvalToken: swap.approveToken || swap.fromToken,
      approvalAmount: swap.amountIn,
    }));
    
    // Criar um bribe opcional para mineradores
    if (minerBribeAmount && minerBribeAmount.gt(0)) {
      const bribeTx = await executorContract.populateTransaction.payMinerERC20(
        flashloanToken, 
        minerBribeAmount
      );
      
      enhancedLogger.debug("Adding miner bribe", {
        category: "executor",
        botType: "profiter",
        data: {
          token: flashloanToken,
          amount: minerBribeAmount.toString()
        }
      });
      
      // Adicionar opções de gás personalizadas se fornecidas
      if (options.gasLimit) bribeTx.gasLimit = ethers.BigNumber.from(options.gasLimit);
      if (options.gasPrice) bribeTx.gasPrice = options.gasPrice;
      if (options.maxPriorityFeePerGas) bribeTx.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
      
      const signedBribe = await signer.signTransaction({
        ...bribeTx,
        nonce: await provider.getTransactionCount(userAddress),
      });
      
      txs.push(signedBribe);
    }
    
    // Popular a transação principal
    const orchestrateTx = await executorContract.populateTransaction.orchestrate(
      flashloanRequest, 
      calls
    );
    
    // Adicionar opções de gás personalizadas se fornecidas
    if (options.gasLimit) orchestrateTx.gasLimit = ethers.BigNumber.from(options.gasLimit);
    if (options.gasPrice) orchestrateTx.gasPrice = options.gasPrice;
    if (options.maxPriorityFeePerGas) orchestrateTx.maxPriorityFeePerGas = options.maxPriorityFeePerGas;
    
    // Assinar a transação principal
    const signedOrchestrate = await signer.signTransaction({
      ...orchestrateTx,
      nonce: await provider.getTransactionCount(userAddress) + txs.length,
    });
    
    // Adicionar a transação principal ao início do array
    txs.unshift(signedOrchestrate);
    
    // Determinar o método de envio
    if (options.useBundle || options.useMevShare) {
      // Enviar como bundle
      enhancedLogger.info("Sending transaction bundle", {
        category: "executor",
        botType: "profiter",
        data: {
          txCount: txs.length,
          useMevShare: !!options.useMevShare
        }
      });
      
      // Bloco alvo, geralmente 1 bloco à frente
      const targetBlock = await provider.getBlockNumber() + 1;
      
      const bundleResult = await sendBundle(txs, targetBlock, signer, {
        alwaysSendToMevShare: !!options.useMevShare
      });
      
      if (bundleResult.success) {
        enhancedLogger.info(`Bundle submitted successfully: ${bundleResult.txHash}`, {
          category: "executor",
          botType: "profiter",
          data: bundleResult
        });
        
        // Salvar no banco de dados
        await saveBotTransaction({
          botType: "profiter",
          action: "arbitrage",
          txHash: bundleResult.txHash,
          status: "submitted",
          profit: route.profitUsd || 0,
          gas: options.gasLimit || 0
        });
        
        return {
          success: true,
          txHash: bundleResult.txHash
        };
      } else {
        enhancedLogger.error(`Bundle submission failed: ${bundleResult.error}`, {
          category: "executor",
          botType: "profiter",
          data: bundleResult
        });
        
        return {
          success: false,
          error: bundleResult.error
        };
      }
    } else {
      // Enviar transação normal
      enhancedLogger.info("Sending regular transaction", {
        category: "executor",
        botType: "profiter"
      });
      
      // Desempacotar a transação assinada
      const tx = await signer.sendTransaction(orchestrateTx);
      
      enhancedLogger.info(`Transaction sent: ${tx.hash}`, {
        category: "executor",
        botType: "profiter",
        data: { txHash: tx.hash }
      });
      
      // Aguardar confirmação
      const receipt = await tx.wait(1); // Aguardar 1 confirmação
      
      enhancedLogger.info(`Transaction confirmed in block ${receipt.blockNumber}`, {
        category: "executor",
        botType: "profiter",
        data: {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        }
      });
      
      // Salvar no banco de dados
      await saveBotTransaction({
        botType: "profiter",
        action: "arbitrage",
        txHash: tx.hash,
        status: "confirmed",
        profit: route.profitUsd || 0,
        gas: receipt.gasUsed.toNumber()
      });
      
      return {
        success: true,
        txHash: tx.hash
      };
    }
  } catch (error) {
    enhancedLogger.error(`Error executing arbitrage: ${error instanceof Error ? error.message : "Unknown error"}`, {
      category: "executor",
      botType: "profiter",
      data: { error }
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
