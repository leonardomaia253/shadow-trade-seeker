import { ethers } from "ethers";
import axios from "axios";
import WebSocket from "ws";
import { JsonRpcProvider } from "@ethersproject/providers";

// Configure com seu header de auth do bloXroute
const BLOXROUTE_AUTH_HEADER = "MDYwY2M5NzgtMTY4MC00YzVmLWE4ZTItMjAyYTcxNjE5OGM4OmFlMTRmMWE3MGY3Y2E3ZGQ0NTFjYTQ5YjRhOGU2Mzcy";
const BLOXROUTE_HTTP_RELAY = "https://mev.api.blxrbdn.com";
const BLOXROUTE_WS_RELAY = "wss://mev.ws.blxrbdn.com";

// Opcional: suporte ao MEV-Share
const MEV_SHARE_URL = "https://relay.flashbots.net";

let ws: WebSocket | null = null;

function getBlockHex(block: number) {
  return `0x${block.toString(16)}`;
}

export async function sendBundle(
  bundleTransactions: Array<{
    signer: ethers.Signer;
    transaction: ethers.providers.TransactionRequest;
  }>,
  provider: JsonRpcProvider
): Promise<{ success: boolean }> {
  try {
    const signedTxs: string[] = [];

    for (const { signer, transaction } of bundleTransactions) {
      if (transaction.raw) {
        // If raw transaction is already provided, use it
        signedTxs.push(transaction.raw as string);
      } else {
        // Otherwise, sign the transaction
        const nonce = await signer.getTransactionCount("latest");
        const gasLimit = transaction.gasLimit || 1_000_000;
        const tx = await signer.populateTransaction({
          ...transaction,
          nonce,
          gasLimit,
        });

        const signedTx = await signer.signTransaction(tx);
        signedTxs.push(signedTx);
      }
    }

    const blockNumber = await provider.getBlockNumber();
    const nextBlock = blockNumber + 1;
    const params = {
      txs: signedTxs,
      block_number: getBlockHex(nextBlock),
      min_timestamp: 0,
      max_timestamp: 0,
      reverting_tx_hashes: [],
    };

    // Envio por WebSocket (latência menor)
    await ensureWebSocket();
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "blxr_submit_bundle",
      params: [params],
    };
    ws!.send(JSON.stringify(payload));

    // Fallback por HTTP
    await axios.post(
      `${BLOXROUTE_HTTP_RELAY}/mev/bundle`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: BLOXROUTE_AUTH_HEADER,
        },
      }
    );

    // Opcional: envio para MEV-Share também
    await axios.post(
      MEV_SHARE_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendBundle",
        params: [
          {
            txs: signedTxs,
            blockNumber: getBlockHex(nextBlock),
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar bundle:", error);
    return { success: false };
  }
}

function ensureWebSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return resolve();
    }

    ws = new WebSocket(BLOXROUTE_WS_RELAY, {
      headers: {
        Authorization: BLOXROUTE_AUTH_HEADER,
      },
    });

    ws.on("open", () => {
      console.log("WebSocket bloXroute conectado.");
      resolve();
    });

    ws.on("error", (err) => {
      console.error("Erro WebSocket:", err);
      reject(err);
    });
  });
}
