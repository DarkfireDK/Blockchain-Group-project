import "dotenv/config";
import { defineConfig, overrideTask } from "hardhat/config";
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import HardhatDeploy from "hardhat-deploy";
import generateTsAbis from "./scripts/generateTsAbis.js";

// Decrypted test-only Sepolia keys are supplied by the deployment wrapper.
// You can get your own at https://dashboard.alchemyapi.io
const providerApiKey = process.env.ALCHEMY_API_KEY || "IZYEU2cWBgnFmgiTAgpWD";

export const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";

const deployTasks = [
  overrideTask("deploy")
    .setInlineAction(async (args, _hre, runSuper) => {
      // Run the original deploy task
      await runSuper(args);
      // Force run the generateTsAbis script
      await generateTsAbis();
    })
    .build(),
];

export default defineConfig({
  plugins: [hardhatToolbox, HardhatDeploy],
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            // https://docs.soliditylang.org/en/latest/using-the-compiler.html#optimizer-options
            runs: 200,
          },
        },
      },
    ],
  },
  generateTypedArtifacts: {
    destinations: [
      {
        folder: "./generated",
        mode: "typescript",
      },
    ],
  },
  // Configuration for hardhat-verify and rocketh-verify
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
  networks: {
    default: { type: "http", url: "http://127.0.0.1:8545" },
    hardhat: { type: "edr-simulated" },
    sepolia: {
      type: "http",
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/" + providerApiKey,
      accounts: process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ? [process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  tasks: deployTasks,
});
