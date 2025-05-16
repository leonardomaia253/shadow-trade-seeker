
import { ethers } from "ethers";
import axios from "axios";
import WebSocket from "ws";
import { JsonRpcProvider } from "@ethersproject/providers";

// bloXroute + Flashbots MEV-Share
const BLOXROUTE_AUTH_HEADER = "SEU_HEADER";
const BLOXROUTE_HTTP_RELAY = "https://mev.api.blxrbdn.com";
const BLOXROUTE_WS_RELAY = "wss://mev.ws.blxrbdn.com";
const MEV_SHARE_URL = "https://relay.flashbots.net";

let ws: WebSocket | null = null;

function getBlockHex(block: number) {
  return `0x${block.toString(16)}`;
}

/**
 * Envia um bundle com transações pré-assinadas ou não.
 */
export async function sendBundle(
  bundleTransactions: Array<{
    signer: ethers.Signer;
    transaction: any;
  }>,
  provider: JsonRpcProvider
): Promise<{ success: boolean }> {
  try {
    const signedTxs: string[] = [];

    for (const { signer, transaction } of bundleTransactions) {
  if ("raw" in transaction) {
    signedTxs.push(transaction.raw);
  } else {
    // aqui transaction é TransactionRequest, posso acessar gasLimit
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
    const currentBlock = await provider.getBlockNumber();
    const nextBlock = currentBlock + 1;
    const blockHex = getBlockHex(nextBlock);

    const bundleParams = {
      txs: signedTxs,
      block_number: blockHex,
      min_timestamp: 0,
      max_timestamp: 0,
      reverting_tx_hashes: [],
    };

    // === Envio via WebSocket bloXroute ===
    await ensureWebSocket();
    ws!.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "blxr_submit_bundle",
        params: [bundleParams],
      })
    );

    // === Envio HTTP bloXroute ===
    await axios.post(
      `${BLOXROUTE_HTTP_RELAY}/mev/bundle`,
      {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "blxr_submit_bundle",
        params: [bundleParams],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: BLOXROUTE_AUTH_HEADER,
        },
      }
    );

    // === Envio opcional via Flashbots MEV-Share ===
    await axios.post(
      MEV_SHARE_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendBundle",
        params: [
          {
            txs: signedTxs,
            blockNumber: blockHex,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Bundle enviado com sucesso.");
    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao enviar bundle:", error);
    return { success: false };
  }
}

async function ensureWebSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();

    ws = new WebSocket(BLOXROUTE_WS_RELAY, {
      headers: {
        Authorization: BLOXROUTE_AUTH_HEADER,
      },
    });

    ws.on("open", () => {
      console.log("🔌 WebSocket bloXroute conectado.");
      resolve();
    });

    ws.on("error", (err) => {
      console.error("❌ Erro WebSocket:", err);
      reject(err);
    });
  });
}
