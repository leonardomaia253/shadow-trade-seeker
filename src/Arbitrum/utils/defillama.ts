import axios from 'axios';
import {TokenInfo} from "./types"

export async function getArbitrumTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const arbitrumTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Arbitrum')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Arbitrum') {
            arbitrumTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return arbitrumTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getAvalancheTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const avalancheTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Avalanche')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Avalanche') {
            avalancheTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return avalancheTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getBaseTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const baseTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Base')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Base') {
            baseTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return baseTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getBinanceTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const binanceTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Binance')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Binance') {
             binanceTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return binanceTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getEthereumTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const ethereumTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Ethereum')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Ethereum') {
            ethereumTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return ethereumTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getOptimismTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const optimismTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Optimism')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Optimism') {
            optimismTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return optimismTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}

export async function getPolygonTokens(): Promise<TokenInfo[]> {
  try {
    const response = await axios.get('https://api.llama.fi/protocols');
    const protocols = response.data;

    const polygonTokens: TokenInfo[] = [];

    for (const protocol of protocols) {
      if (protocol.chains.includes('Polygon')) {
        // Supondo que cada protocolo tenha uma lista de tokens com informações detalhadas
        for (const token of protocol.tokens || []) {
          if (token.chain === 'Polygon') {
            polygonTokens.push({
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            });
          }
        }
      }
    }

    return polygonTokens;
  } catch (error) {
    console.error('Erro ao obter tokens da DefiLlama:', error);
    return [];
  }
}