import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from 'dotenv'

dotenv.config();

const TESTNET_PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY || "";
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  paths: {
    artifacts: "./artifacts",
  },
  ignition: {
    requiredConfirmations: 1
  },
  networks: {
    localhost: {
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
      url: "http://localhost:8545/",
    },
    hardhat: {
      hardfork: "cancun"
    },
    sepolia: {
      accounts: [TESTNET_PRIVATE_KEY || ""],
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
    },
    minato: {
      accounts: [TESTNET_PRIVATE_KEY || ""],
      url: "http://rpc.minato.soneium.org",
      chainId: 1946,
    },
    ethereum: {
      accounts: [MAINNET_PRIVATE_KEY || ""],
      url: "https://eth-mainnet.public.blastapi.io"
    },
    soneium: {
      accounts: [MAINNET_PRIVATE_KEY || ""],
      url: "https://rpc.soneium.org",
      chainId: 1868,
    },
  },
  etherscan: {
    apiKey: {
      minato: " ",
      soneium: " ",
      ethereum: " ",
      sepolia: " "
    },
    customChains: [
      {
        network: "minato",
        chainId: 1946,
        urls: {
          apiURL: "https://soneium-minato.blockscout.com/api",
          browserURL: "https://soneium-minato.blockscout.com",
        },
      },
      {
        network: "soneium",
        chainId: 1868,
        urls: {
          apiURL: "https://soneium.blockscout.com/api",
          browserURL: "https://soneium.blockscout.com",
        },
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://eth-sepolia.blockscout.com/api",
          browserURL: "https:/eth-sepolia.blockscout.com",
        },
      }
    ],
  },
};

export default config;
