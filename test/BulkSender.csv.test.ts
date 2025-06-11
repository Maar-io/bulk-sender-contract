import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTokenFixture } from "./fixture";
import * as path from "path";
import { TransferData, loadCSVData, logCSVInfo, createBatches, storeInitialBalances, verifyRandomSamples } from "./helpers";

describe("BulkSender CSV Processing", function () {
  this.timeout(60000);
  const batchSize = 600n;

  describe("bulkSendERC20Different with CSV data", function () {
    let csvData: TransferData[];
    
    before(async function () {
      const csvPath = path.join(__dirname, "test-data", "recipients.csv");
      csvData = loadCSVData(csvPath);
      logCSVInfo(csvData);
      
      expect(csvData.length).to.be.greaterThan(0, "CSV should contain entries");
    });

    it("should process large CSV file in batches of batchSize", async function () {
      const { AstrToken, BulkSender, owner } = await loadFixture(deployTokenFixture);

      await BulkSender.write.setRecipientLimit([batchSize], { account: owner.account });
      
      const recipientLimit = await BulkSender.read.getRecipientLimit();
      expect(recipientLimit).to.equal(batchSize);

      const totalAmount = csvData.reduce((sum, entry) => sum + entry.amount, 0n);
      console.log(`Total amount needed: ${totalAmount}`);

      await AstrToken.write.setBalance([owner.account.address, totalAmount * 2n]);
      await AstrToken.write.approve([BulkSender.address, totalAmount], {
        account: owner.account,
      });

      const batches = createBatches(csvData, 200);
      console.log(`Processing ${batches.length} batches`);

      const initialBalances = new Map<string, bigint>();
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} recipients`);

        const recipients = batch.map(entry => entry.address as `0x${string}`);
        const amounts = batch.map(entry => entry.amount);

        await storeInitialBalances(recipients, AstrToken, initialBalances);

        await BulkSender.write.bulkSendERC20Different([
          AstrToken.address,
          recipients,
          amounts,
        ], { account: owner.account, value: 0n });

        console.log(`Batch ${batchIndex + 1} completed`);
        await verifyRandomSamples(recipients, amounts, initialBalances, AstrToken);
      }

      let totalTransferred = 0n;
      for (const [recipient, initialBalance] of initialBalances.entries()) {
        const finalBalance = await AstrToken.read.balanceOf([recipient as `0x${string}`]);
        totalTransferred += (finalBalance - initialBalance);
      }

      expect(totalTransferred).to.equal(totalAmount);
      console.log(`Successfully transferred ${totalTransferred} tokens to ${csvData.length} recipients`);
    });

    it("should reject batch exceeding recipient limit", async function () {
      const { AstrToken, BulkSender, owner } = await loadFixture(deployTokenFixture);

      await BulkSender.write.setRecipientLimit([10n], { account: owner.account });

      const largeBatch = csvData.slice(0, 15);
      const recipients = largeBatch.map(entry => entry.address as `0x${string}`);
      const amounts = largeBatch.map(entry => entry.amount);

      await expect(
        BulkSender.write.bulkSendERC20Different([
          AstrToken.address,
          recipients,
          amounts,
        ], { account: owner.account, value: 0n })
      ).to.be.rejectedWith("BulkSender: Exceeds recipient limit");
    });

    it("should handle edge case with exactly 200 recipients", async function () {
      const { AstrToken, BulkSender, owner } = await loadFixture(deployTokenFixture);

      await BulkSender.write.setRecipientLimit([batchSize], { account: owner.account });

      const exactBatch = csvData.slice(0, 200);
      const recipients = exactBatch.map(entry => entry.address as `0x${string}`);
      const amounts = exactBatch.map(entry => entry.amount);
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n);

      await AstrToken.write.setBalance([owner.account.address, totalAmount]);
      await AstrToken.write.approve([BulkSender.address, totalAmount], {
        account: owner.account,
      });

      await BulkSender.write.bulkSendERC20Different([
        AstrToken.address,
        recipients,
        amounts,
      ], { account: owner.account, value: 0n });

      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * recipients.length);
        const balance = await AstrToken.read.balanceOf([recipients[randomIndex]]);
        expect(balance).to.equal(amounts[randomIndex]);
      }
    });

    it("should handle duplicate addresses correctly", async function () {
      const { AstrToken, BulkSender, owner } = await loadFixture(deployTokenFixture);

      const firstEntry = csvData[0];
      const testBatch = [firstEntry, csvData[1], firstEntry, csvData[2]];

      const recipients = testBatch.map(entry => entry.address as `0x${string}`);
      const amounts = testBatch.map(entry => entry.amount);
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n);

      await AstrToken.write.setBalance([owner.account.address, totalAmount]);
      await AstrToken.write.approve([BulkSender.address, totalAmount], {
        account: owner.account,
      });

      await BulkSender.write.bulkSendERC20Different([
        AstrToken.address,
        recipients,
        amounts,
      ], { account: owner.account, value: 0n });

      const duplicateAddress = firstEntry.address as `0x${string}`;
      const expectedBalance = firstEntry.amount + firstEntry.amount;
      const actualBalance = await AstrToken.read.balanceOf([duplicateAddress]);
      
      expect(actualBalance).to.equal(expectedBalance);
    });
  });
});