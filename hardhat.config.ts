import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "solidity-coverage";
require("hardhat-gas-reporter");
import dotenv from "dotenv";

dotenv.config();

const SYSTEM_PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY || "1".repeat(64);
const SYSTEM_TEST_PRIVATE_KEY =
  process.env.SYSTEM_TEST_PRIVATE_KEY || "1".repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    compilers: [
      {
        version: "0.8.16",
        settings: { optimizer: { enabled: true, runs: 1000 } },
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
    hardhat: {
      accounts: { count: 100, accountsBalance: "1000000000000000000000000" },
    },
    // Mainnet
    ethereum: {
      url: process.env.ETHEREUM_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
    binance: {
      url: process.env.BINANCE_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
    polygon: {
      url: process.env.POLYGON_RPC,
      accounts: [SYSTEM_PRIVATE_KEY],
    },
    // Testnet
    binance_testnet: {
      url: process.env.BINANCE_TESTNET_RPC,
      accounts: [SYSTEM_TEST_PRIVATE_KEY],
    },
    goerli: {
      url: process.env.GOERLI_RPC,
      accounts: [SYSTEM_TEST_PRIVATE_KEY],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC,
      accounts: [SYSTEM_TEST_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      // Mainnet
      mainnet: process.env.ETHER_API_KEY || "",
      bsc: process.env.BINANCE_API_KEY || "",
      polygon: process.env.POLYGON_API_KEY || "",
      // Testnet
      goerli: process.env.ETHER_API_KEY || "",
      bscTestnet: process.env.BINANCE_API_KEY || "",
      mumbai: process.env.POLYGON_API_KEY || "",
    },
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    token: "BNB",
    gasPrice: 30,
    coinmarketcap: process.env.COIN_MARKET_API,
  },
  mocha: {
    timeout: 200000,
    reporter: "mocha-multi-reporters",
    reporterOptions: { configFile: "./mocha-report.json" },
  },
};

export default config;
