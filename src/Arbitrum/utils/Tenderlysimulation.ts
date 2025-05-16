
import axios from 'axios';
import { ethers } from 'ethers';

const TENDERLY_USER = "Volup";
const TENDERLY_PROJECT = "project";
const TENDERLY_ACCESS_KEY = "xlY4N6Y4R2e0kXsdaff3uMmRRSvdeIb1";

interface SimulationResult {
  success: boolean;
  simulationId?: string;
  raw?: any;
}

function parseSignedTxsForTenderly(signedTxs: string[]) {
  return signedTxs.map((raw) => {
    const tx = ethers.utils.parseTransaction(raw);

    if (!tx.from) {
      throw new Error(`Transação não possui campo 'from': ${raw}`);
    }

    return {
      to: tx.to ?? ethers.constants.AddressZero,
      input: tx.data,
      gas: tx.gasLimit?.toNumber() ?? 8000000, // fallback seguro
      gas_price: tx.gasPrice?.toNumber() ?? 0,
      value: tx.value.toString(),
      from: tx.from,
      nonce: tx.nonce,
    };
  });
}

export const simulateBundleWithTenderly = async (
  signedTxs: string[],
  networkId: string = '42161',
): Promise<SimulationResult> => {
  if (!signedTxs || signedTxs.length === 0) {
    throw new Error('Nenhuma transação assinada fornecida para simulação');
  }

  try {
    const transactions = parseSignedTxsForTenderly(signedTxs);

    const response = await axios.post(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate-bundle`,
      {
        network_id: networkId,
        transactions,
        save: true,
        save_if_fails: true,
      },
      {
        headers: {
          'X-Access-Key': TENDERLY_ACCESS_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const simResults = response.data?.simulation_results;
    const allSuccess = simResults.every((res: any) => res.simulation.status === true);

    // Não há um simulation.id padrão para bundle, mas podemos retornar todos os dados
    return {
      success: allSuccess,
      raw: simResults,
    };
  } catch (error: any) {
    console.error("Erro ao simular bundle na Tenderly:", error.response?.data || error.message);
    return {
      success: false,
    };
  }
};
