// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition
// npx hardhat ignition deploy ./ignition/modules/BulkSender-soneium.ts --network soneium
// npx hardhat ignition verify chain-1868 --include-unrelated-contracts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// read owner address from the environment
const PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace(/^0x/, '')}`);
const ownerAddress = account.address;

const BulkSenderModule = buildModule("BulkSender", (m) => {

  const bulk = m.contract("BulkSender", [ownerAddress]);

  return { bulk };
});

export default BulkSenderModule;
