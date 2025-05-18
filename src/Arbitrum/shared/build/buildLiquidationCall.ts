import { ethers } from "ethers";

export function getLiquidationCallData({
  protocol,
  params,
}: {
  protocol: string;
  params: any; // os parâmetros necessários para o protocolo
}): string {
  switch (protocol.toLowerCase()) {
    case "aave": {
      // liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken)
      const abi = ["function liquidationCall(address,address,address,uint256,bool)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidationCall", [
        params.collateralAsset,
        params.debtAsset,
        params.user,
        params.debtToCover,
        params.receiveAToken ?? false,
      ]);
    }
    case "compound": {
      // liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral)
      const abi = ["function liquidateBorrow(address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidateBorrow", [
        params.borrower,
        params.repayAmount,
        params.cTokenCollateral,
      ]);
    }
    case "morpho": {
      // morpho has different versions, vamos supor o método de liquidate no contrato principal
      const abi = ["function liquidate(address borrower, address cTokenCollateral, uint256 repayAmount)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidate", [
        params.borrower,
        params.cTokenCollateral,
        params.repayAmount,
      ]);
    }
    case "spark": {
      // Exemplo genérico, ajustar conforme documentação real do Spark
      const abi = ["function liquidate(address borrower, address collateral, uint256 repayAmount)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidate", [
        params.borrower,
        params.collateral,
        params.repayAmount,
      ]);
    }
    case "venus": {
      // liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral)
      const abi = ["function liquidateBorrow(address,uint256,address)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidateBorrow", [
        params.borrower,
        params.repayAmount,
        params.cTokenCollateral,
      ]);
    }
    case "abracadabra": {
      // Abracadabra tem vários mercados, liquidate função pode variar, aqui um exemplo genérico:
      const abi = ["function liquidate(address user, uint256 repayAmount, address collateral)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidate", [
        params.user,
        params.repayAmount,
        params.collateral,
      ]);
    }
    case "radiant": {
      // Radiant provavelmente usa algo semelhante ao Aave, aqui um exemplo genérico
      const abi = ["function liquidate(address collateralAsset, address debtAsset, address user, uint256 debtToCover)"];
      const iface = new ethers.utils.Interface(abi);
      return iface.encodeFunctionData("liquidate", [
        params.collateralAsset,
        params.debtAsset,
        params.user,
        params.debtToCover,
      ]);
    }
    default:
      throw new Error(`Protocolo ${protocol} não suportado para liquidacao`);
  }
}
