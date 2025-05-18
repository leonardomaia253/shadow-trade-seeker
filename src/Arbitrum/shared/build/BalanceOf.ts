import { ethers } from "ethers";

export async function getWETHBalance({
  provider,
}: {
  provider: ethers.providers.Provider;
}) {
  const weth = new ethers.Contract("0x82af49447d8a07e3bd95bd0d56f35241523fbab1", ["function balanceOf(address) view returns (uint256)"], provider);
  return await weth.balanceOf("0xebc996030ad65e113ba2f03e55de080044b83dca");
}
