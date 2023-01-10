import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";

import dotenv from "dotenv";
dotenv.config();

const BINANCE_MAINNET_RPC = process.env.MAINNET_RPC || "1".repeat(32);
const SYSTEM_PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY || "1".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    compilers: [
      {
        version: "0.8.17",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: { accounts: { count: 100 } },
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
    goerli: {
      url: process.env.GOERLI_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BINANCE_API_KEY || "",
      goerli: process.env.ETHER_API_KEY || "",
    },
  },
  mocha: {
    timeout: 200000,
    reporter: "mocha-multi-reporters",
    reporterOptions: { configFile: "./mocha-report.json" },
  },
};

export default config;
