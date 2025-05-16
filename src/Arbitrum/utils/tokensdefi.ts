import axios from 'axios';

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export async function fetchTopTokensArbitrum(limit: number = 200): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/token/arbitrum');
    const tokens = response.data.tokens as any[];

    // Ordena os tokens por volume de 24h em ordem decrescente
    tokens.sort((a, b) => b.volume24hUSD - a.volume24hUSD);

    // Seleciona os top 'limit' tokens
    const topTokens = tokens.slice(0, limit);

    // Mapeia para o formato TokenInfo
    return topTokens.map(token => ({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
    }));
  } catch (error) {
    console.error('Erro ao buscar tokens da DeFiLlama:', error);
    return [];
  }
}
