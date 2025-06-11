// fixture.ts
import * as hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Hex } from "viem";

// A deployment function to set up the initial state
export const deployTokenFixture = async () => {
  // Get wallet clients for testing
  const [owner, nonOwner, recipient1, recipient2, recipient3] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Deploy the contracts
  const AstrToken = await hre.viem.deployContract("MockERC20", [
    "ASTR",
    "ASTR",
    1000000000n
  ]);

  const BulkSender = await hre.viem.deployContract("BulkSender", [
    owner.account.address,
  ]);

  const distributionAmount = 10000n; // Increased for testing

  // Fund the owner with tokens for distribution (not the contract)
  await AstrToken.write.setBalance([owner.account.address, distributionAmount]);

  return {
    AstrToken,
    BulkSender,
    owner,
    nonOwner,
    recipient1,
    recipient2,
    recipient3,
    publicClient,
  };
};
