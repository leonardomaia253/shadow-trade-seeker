import { ethers } from "ethers";
import { 
  DexType, 
  BuiltRoute, 
  CallData, 
  DexSwap,
  SwapCallParams 
} from "../../utils/types";
import { buildSwapTransaction } from "../../shared/build/buildSwap";
import { buildOrchestrateCall } from "../../shared/build/buildOrchestrate"; 
import { encodePayMiner } from "../../shared/build/payMinerCall"; 

export async function buildArbRoutesWithFlashloan({
  tokens,
  hops,
  maxRoutes,
  flashLoanToken,
  flashLoanAmount,
  expectedProfitToken,
  minerReward,
}: {
  tokens: string[];
  hops: number;
  maxRoutes: number;
  flashLoanToken: string;
  flashLoanAmount: ethers.BigNumberish;
  expectedProfitToken: string;
  minerReward: ethers.BigNumberish;
}): Promise<Array<{ route: BuiltRoute; flashloanCallData: string }>> {
  const routesWithFlashloan = [];
  const routes = await buildArbRoutes({ tokens, hops, maxRoutes });

  for (const route of routes) {
    // 3. Pay miner with profit token
    const minerCall: CallData = await encodePayMiner({
      token: expectedProfitToken,
      amount: minerReward,
    });

    // 4. Agrupar calls (swaps + minerCall)
    const calls: CallData[] = [...route.calls, minerCall];

    // 5. Construir calldata do flashloan
    const flashloanCallData = await buildOrchestrateCall({
      token: flashLoanToken,
      amount: flashLoanAmount,
      calls,
    });

    routesWithFlashloan.push({
      route,
      flashloanCallData,
    });
  }

  return routesWithFlashloan;
}

// Função que gera rotas arbitrárias (igual seu código original)
export async function buildArbRoutes({
  tokens,
  hops,
  maxRoutes,
}: {
  tokens: string[];
  hops: number;
  maxRoutes: number;
}): Promise<BuiltRoute[]> {
  const routes: BuiltRoute[] = [];
  const seenRoutes = new Set<string>();

  for (const baseToken of tokens) {
    const others = tokens.filter((t) => t !== baseToken);
    const paths = generateUniqueLoops(baseToken, others, hops);

    for (const path of paths) {
      const routeKey = path.join("-");
      if (seenRoutes.has(routeKey)) continue;

      const swapCalls = await buildSwapSequence(path);
      if (!swapCalls) continue;

      routes.push({
        path,
        swaps: swapCalls,
        calls: swapCalls.map(dexSwapToCallData),
        inputToken: path[0],
      });
      seenRoutes.add(routeKey);

      if (routes.length >= maxRoutes) {
        return sortRoutesByProfit(routes);
      }
    }
  }

  return sortRoutesByProfit(routes);
}

// Constrói sequência de swaps para rota circular
async function buildSwapSequence(path: string[]): Promise<DexSwap[] | null> {
  const promises = [];

  for (let i = 0; i < path.length - 1; i++) {
    promises.push(
      buildSwapTransaction({
        tokenIn: path[i],
        tokenOut: path[i + 1],
      })
    );
  }

  const results = await Promise.allSettled(promises);

  const swaps: DexSwap[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      swaps.push(result.value);
    } else {
      return null;
    }
  }

  // Garante loop fechado
  if (swaps[0].tokenIn !== swaps[swaps.length - 1].tokenOut) return null;

  const amountIn = swaps[0].amountIn;
  const amountOut = swaps[swaps.length - 1].amountOut;

  // Slippage mínimo 0.5%
  const minOut = amountIn.mul(1005).div(1000);
  if (amountOut.lt(minOut)) return null;

  return swaps;
}

// Gera caminhos circulares únicos com N hops
function generateUniqueLoops(base: string, tokens: string[], hops: number): string[][] {
  const results: string[][] = [];

  function dfs(path: string[], used: Set<string>) {
    if (path.length === hops) {
      results.push([base, ...path, base]);
      return;
    }

    for (const token of tokens) {
      if (!used.has(token)) {
        used.add(token);
        path.push(token);
        dfs(path, used);
        path.pop();
        used.delete(token);
      }
    }
  }

  dfs([], new Set());
  return results;
}

// Ordena rotas por lucro estimado
function sortRoutesByProfit(routes: BuiltRoute[]): BuiltRoute[] {
  return routes.map(route => {
    const inAmt = route.swaps[0].amountIn;
    const outAmt = route.swaps[route.swaps.length - 1].amountOut;
    const profit = outAmt.sub(inAmt);

    return {
      ...route,
      estimatedProfit: profit,
    };
  }).sort((a, b) => {
    if (!a.estimatedProfit || !b.estimatedProfit) return 0;
    return b.estimatedProfit.gt(a.estimatedProfit) ? 1 : -1;
  });
}

// Transforma DexSwap em CallData
export function dexSwapToCallData(swap: DexSwap): CallData {
  return {
    target: swap.target,
    data: swap.callData,
    requiresApproval: true,
    approvalToken: swap.approveToken,
    approvalAmount: swap.amountIn,
    value: "0",
  };
}



