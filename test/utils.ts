const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const Big = require("big.js");
import hre from "hardhat";
import { ethers } from "hardhat";
const { MerkleTree } = require("merkletreejs");
const { expect } = require("chai");
const keccak256 = require("keccak256");

// const blockTimestamp = async () => {
//   return (await ethers.provider.getBlock()).timestamp;
// };

const weiToEther = (weiValue: number) => {
  return ethers.utils.formatEther(weiValue);
};

const skipTime = async (seconds: number) => {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
};

export { skipTime };
