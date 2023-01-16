import { BigNumber } from "ethers";
import hre from "hardhat";
import { ethers } from "hardhat";

const blockTimestamp = async (): Promise<BigNumber> => {
  try {
    return BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
  } catch (error: any) {
    throw Error(error);
  }
};

const weiToEther = (weiValue: number) => {
  return ethers.utils.formatEther(weiValue);
};

const skipTime = async (seconds: number) => {
  try {
    await hre.network.provider.send("evm_increaseTime", [seconds]);
    await hre.network.provider.send("evm_mine");
  } catch (error: any) {
    throw Error(error);
  }
};

export { blockTimestamp, skipTime, weiToEther };
