
import { ethers } from "ethers";

export function getLiquidationCallData({
  protocol,
  params,
}: {
  protocol: string;
  params: any; // os parâmetros necessários para o protocolo
}): {target: string, callData: string} {
  switch (protocol.toLowerCase()) {
    case "aave": {
      // liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken)
      const aavePool = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
      const abi = ["function liquidationCall(address,address,address,uint256,bool)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidationCall", [
        params.collateralAsset,
        params.debtAsset,
        params.user || params.borrower,
        params.amount || params.debtToCover,
        params.receiveAToken ?? false,
      ]);
      return { target: aavePool, callData };
    }
    case "compound": {
      // liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral)
      const compoundPool = "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1";
      const abi = ["function liquidateBorrow(address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidateBorrow", [
        params.borrower || params.user,
        params.amount || params.repayAmount,
        params.cTokenCollateral || params.collateralAsset,
      ]);
      return { target: compoundPool, callData };
    }
    case "morpho": {
      // morpho has different versions
      const morphoBlue = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
      const abi = ["function liquidate(address,address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidate", [
        params.marketParams || {},
        params.borrower || params.user,
        params.amount || params.repayAmount,
        params.fromToken || params.collateralAsset,
      ]);
      return { target: morphoBlue, callData };
    }
    case "spark": {
      const sparkPool = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
      const abi = ["function liquidate(address,address,uint256)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidate", [
        params.borrower || params.user,
        params.collateral || params.collateralAsset,
        params.amount || params.repayAmount,
      ]);
      return { target: sparkPool, callData };
    }
    case "venus": {
      // liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral)
      const venusPool = "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1";
      const abi = ["function liquidateBorrow(address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidateBorrow", [
        params.borrower || params.user,
        params.amount || params.repayAmount,
        params.vTokenCollateral || params.cTokenCollateral || params.collateralAsset,
      ]);
      return { target: venusPool, callData };
    }
    case "abracadabra": {
      // Abracadabra tem vários mercados
      const abracadabraPool = "0x5345B5f4f3bFf1F4C1A2aFf3Ff1F4C1A2aFf3Ff1";
      const abi = ["function liquidate(address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidate", [
        params.user || params.borrower,
        params.amount || params.repayAmount,
        params.collateral || params.collateralAsset,
      ]);
      return { target: abracadabraPool, callData };
    }
    case "radiant": {
      // Radiant usa algo semelhante ao Aave
      const radiantPool = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
      const abi = ["function liquidate(address,address,address,uint256)"];
      const iface = new ethers.utils.Interface(abi);
      const callData = iface.encodeFunctionData("liquidate", [
        params.collateralAsset,
        params.debtAsset,
        params.user || params.borrower,
        params.amount || params.debtToCover,
      ]);
      return { target: radiantPool, callData };
    }
    default:
      throw new Error(`Protocolo ${protocol} não suportado para liquidacao`);
  }
}
