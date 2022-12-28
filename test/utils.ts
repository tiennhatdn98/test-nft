const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
import hre from "hardhat";
import { ethers } from "hardhat";

const blockTimestamp = async () => {
  return (await ethers.provider.getBlock("latest")).timestamp;
};

const weiToEther = (weiValue: number) => {
  return ethers.utils.formatEther(weiValue);
};

const skipTime = async (seconds: number) => {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
};

export { blockTimestamp, skipTime };
