import { ethers } from "ethers";
import fetch from "node-fetch";

// ABI mínima do Chainlink Aggregator
const aggregatorV3InterfaceABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
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

async function getLatestPrice(feedAddress: string, provider: ethers.providers.Provider): Promise<{
  price: ethers.BigNumber;
  decimals: number;
}> {
  const feed = new ethers.Contract(feedAddress, aggregatorV3InterfaceABI, provider);
  const [roundData, decimals] = await Promise.all([
    feed.latestRoundData(),
    feed.decimals(),
  ]);
  const answer = roundData.answer;
  if (answer.lte(0)) throw new Error("Invalid price from feed");
  return {
    price: ethers.BigNumber.from(answer.toString()),
    decimals,
  };
}

/**
 * Retorna o preço do token em ETH usando Chainlink de forma dinâmica
 */
export async function getTokenPriceInEthDynamic({
  tokenSymbol,
  provider,
  network = "arbitrum",
}: {
  tokenSymbol: string;
  provider: ethers.providers.Provider;
  network?: string;
}): Promise<ethers.BigNumber> {
  const token = tokenSymbol.toLowerCase();

  try {
    // Busca feeds da Chainlink
    const res = await fetch(`https://data.chain.link/${network}/mainnet/price-feeds`);
    const feeds: {
      address: string;
      base: string;
      quote: string;
    }[] = await res.json();

    let tokenEthFeed: string | undefined;
    let tokenUsdFeed: string | undefined;
    let ethUsdFeed: string | undefined;

    for (const feed of feeds) {
      const base = feed.base.toLowerCase();
      const quote = feed.quote.toLowerCase();

      if (base === token && quote === "eth") tokenEthFeed = feed.address;
      if (base === token && quote === "usd") tokenUsdFeed = feed.address;
      if (base === "eth" && quote === "usd") ethUsdFeed = feed.address;
    }

    if (tokenEthFeed) {
      const { price, decimals } = await getLatestPrice(tokenEthFeed, provider);
      return price.mul(ethers.BigNumber.from(10).pow(18 - decimals));
    }

    if (tokenUsdFeed && ethUsdFeed) {
      const tokenUsd = await getLatestPrice(tokenUsdFeed, provider);
      const ethUsd = await getLatestPrice(ethUsdFeed, provider);

      const tokenUsdAdj = tokenUsd.price.mul(ethers.BigNumber.from(10).pow(18 - tokenUsd.decimals));
      const ethUsdAdj = ethUsd.price.mul(ethers.BigNumber.from(10).pow(18 - ethUsd.decimals));

      const priceInEth = tokenUsdAdj.mul(ethers.BigNumber.from(10).pow(18)).div(ethUsdAdj);
      return priceInEth;
    }

    console.warn(`Feeds insuficientes para calcular preço em ETH para ${tokenSymbol}`);
    return ethers.BigNumber.from(0);
  } catch (err) {
    console.error(`Erro ao obter preço em ETH para ${tokenSymbol}:`, err);
    return ethers.BigNumber.from(0);
  }
}
