import { ethers } from "ethers";
import { Call } from "../../utils/types";
import { EXECUTOR_CONTRACTARBITRUM } from "../../constants/contracts";
import { sendBundle } from "../../executor/sendBundle";

const MultiFlashLoanExecutorABI = [
  "function orchestrate((address provider,address token,uint256 amount)[],(address target,bytes data,bool requiresApproval,address approvalToken,uint256 approvalAmount)[]) external",
  "function payMinerERC20(address token, uint256 amount) external"
];


export async function getExecutorContract(provider: ethers.providers.Provider, privateKey: string) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(EXECUTOR_CONTRACTARBITRUM, MultiFlashLoanExecutorABI, wallet);
  return contract;
}

export async function buildRouteTxRequest(
  contract: ethers.Contract,
  flashloanRequest: { provider: string; token: string; amount: ethers.BigNumber }[],
  calls: Call[],
  overrides?: ethers.PayableOverrides
): Promise<ethers.providers.TransactionRequest> {
  const txRequest = await contract.populateTransaction.orchestrate(flashloanRequest, calls, overrides || {});
  return {
    ...txRequest,
    gasLimit: txRequest.gasLimit ?? ethers.BigNumber.from(1_000_000),
    nonce: await contract.signer.getTransactionCount("latest"),
  };
}

export async function executeFlashloanBundle(
  contract: ethers.Contract,
  flashloanRequest: { provider: string; token: string; amount: ethers.BigNumber }[],
  calls: Call[],
  provider: ethers.providers.Provider,
  overrides?: ethers.PayableOverrides
) {
  try {
    // Construir a transação
    const txRequest = await buildRouteTxRequest(contract, flashloanRequest, calls, overrides);

    // Preparar o bundle para envio
    const bundleTransactions = [
      {
        signer: contract.signer,
        transaction: txRequest,
      },
    ];

    // Enviar bundle via bloXroute + MEV-Share
    const provider = new ethers.providers.JsonRpcProvider("http://arb-mainnet.g.alchemy.com/v2/o--1ruggGezl5R36rrSDX8JiVouHQOJO");
    const result = await sendBundle(bundleTransactions, provider);

    if (result.success) {
      console.log("✅ Bundle enviado com sucesso");
    } else {
      console.error("❌ Falha no envio do bundle");
    }
  } catch (error) {
    console.error("Erro executando flashloan bundle:", error);
  }
}
