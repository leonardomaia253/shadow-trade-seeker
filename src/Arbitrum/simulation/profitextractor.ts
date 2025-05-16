import { BigNumber, ethers } from "ethers";

type TokenTransfer = {
  from: string;
  to: string;
  token_address: string;
  raw_amount: string;
};

type SimulationResult = {
  simulation: {
    status: boolean;
    gas_used: number;
    id: string;
    transaction: {
      transaction_info: {
        token_transfers: TokenTransfer[];
      };
    };
  };
};

function addToMap(
  map: Record<string, BigNumber>,
  token: string,
  amount: BigNumber
) {
  if (!map[token]) {
    map[token] = BigNumber.from(0);
  }
  map[token] = map[token].add(amount);
}

export function extractProfit(
  transfers: any[],
  contractAddress: string,
  bribeRecipientAddresses: string[] = []
): Record<string, BigNumber> {
  const address = contractAddress.toLowerCase();
  const bribeRecipients = new Set(bribeRecipientAddresses.map(a => a.toLowerCase()));

  const netProfit: Record<string, BigNumber> = {};

  for (const transfer of transfers) {
    const token = transfer.token_address.toLowerCase();
    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    const value = BigNumber.from(transfer.value);

    // 1. Valor recebido pelo contrato executor → conta como lucro
    if (to === address) {
      addToMap(netProfit, token, value);
    }

    // 2. Valor saindo do contrato para outro destino
    if (from === address) {
      // Se foi um bribe (pagamento ao minerador), ignoramos
      if (!bribeRecipients.has(to)) {
        addToMap(netProfit, token, value.mul(-1));
      }
    }
  }

  // Remove tokens com lucro zero ou negativo
  for (const [token, amount] of Object.entries(netProfit)) {
    if (amount.lte(0)) {
      delete netProfit[token];
    }
  }

  return netProfit;
}