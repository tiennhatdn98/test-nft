import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

import dotenv from "dotenv";
dotenv.config();

const BINANCE_MAINNET_RPC = process.env.MAINNET_RPC || "1".repeat(32);
const SYSTEM_PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY || "1".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    // Mainnet
    binance: {
      url: BINANCE_MAINNET_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
    // Testnet
    binance_testnet: {
      url: process.env.BINANCE_TESTNET_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BINANCE_API_KEY || "",
    },
  },
};

export default config;
