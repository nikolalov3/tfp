require("@nomicfoundation/hardhat-toolbox")
require("@semaphore-protocol/hardhat")
require("dotenv").config()

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : []

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.23",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts
    },
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      chainId: 8453,
      accounts
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_KEY || "",
      base: process.env.BASESCAN_KEY || ""
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: { apiURL: "https://api-sepolia.basescan.org/api", browserURL: "https://sepolia.basescan.org" }
      },
      {
        network: "base",
        chainId: 8453,
        urls: { apiURL: "https://api.basescan.org/api", browserURL: "https://basescan.org" }
      }
    ]
  },
  mocha: { timeout: 300000 }
}
