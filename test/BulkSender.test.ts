// BulkSender.test.ts
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTokenFixture } from "./fixture";

describe("BulkSender", function () {
    describe("bulkSendERC20Different", function () {
        it("should send different amounts of ERC20 tokens to multiple recipients", async function () {
            const {
                AstrToken,
                BulkSender,
                owner,
                recipient1,
                recipient2,
                recipient3
            } = await loadFixture(deployTokenFixture);

            // Test parameters
            const recipients = [
                recipient1.account.address,
                recipient2.account.address,
                recipient3.account.address,
            ];
            const amounts = [100n, 200n, 300n];
            const totalAmount = amounts.reduce((sum: bigint, amount: bigint) => sum + amount, 0n);

            // Check initial balances
            const initialOwnerBalance = await AstrToken.read.balanceOf([owner.account.address]);
            expect(initialOwnerBalance >= totalAmount).to.be.true;
            // Approve BulkSender to spend tokens
            await AstrToken.write.approve([BulkSender.address, totalAmount], {
                account: owner.account,
            });

            // Check allowance
            const allowance = await AstrToken.read.allowance([
                owner.account.address,
                BulkSender.address,
            ]);
            expect(allowance).to.equal(totalAmount);

            // Execute bulk send (no fee set, so msg.value = 0)
            const tx = await BulkSender.write.bulkSendERC20Different([
                AstrToken.address,
                recipients,
                amounts,
            ], {
                account: owner.account,
                value: 0n,
            });

            // Verify balances after transfer
            const recipient1Balance = await AstrToken.read.balanceOf([recipient1.account.address]);
            const recipient2Balance = await AstrToken.read.balanceOf([recipient2.account.address]);
            const recipient3Balance = await AstrToken.read.balanceOf([recipient3.account.address]);
            const finalOwnerBalance = await AstrToken.read.balanceOf([owner.account.address]);

            // Assertions
            expect(recipient1Balance).to.equal(amounts[0]);
            expect(recipient2Balance).to.equal(amounts[1]);
            expect(recipient3Balance).to.equal(amounts[2]);
            expect(Number(finalOwnerBalance)).to.equal(Number(initialOwnerBalance - totalAmount));

            // Verify the event was emitted
            // Note: Event verification syntax may vary depending on your testing setup
            // This is a general example - adjust based on your event testing approach
        });

        it("should revert when arrays have different lengths", async function () {
            const { AstrToken, BulkSender, owner, recipient1 } = await loadFixture(deployTokenFixture);

            const recipients = [recipient1.account.address];
            const amounts = [100n, 200n]; // Different length

            await expect(
                BulkSender.write.bulkSendERC20Different([
                    AstrToken.address,
                    recipients,
                    amounts,
                ], {
                    account: owner.account,
                    value: 0n,
                })
            ).to.be.rejectedWith("BulkSender: Array length mismatch");
        });

        it("should revert when amount is zero", async function () {
            const { AstrToken, BulkSender, owner, recipient1 } = await loadFixture(deployTokenFixture);

            const recipients = [recipient1.account.address];
            const amounts = [0n]; // Zero amount

            await expect(
                BulkSender.write.bulkSendERC20Different([
                    AstrToken.address,
                    recipients,
                    amounts,
                ], {
                    account: owner.account,
                    value: 0n,
                })
            ).to.be.rejectedWith("BulkSender: Amount must be greater than 0");
        });

        it("should revert when recipient address is zero", async function () {
            const { AstrToken, BulkSender, owner } = await loadFixture(deployTokenFixture);

            const recipients: `0x${string}`[] = ["0x0000000000000000000000000000000000000000"];
            const amounts = [100n];

            // Approve first
            await AstrToken.write.approve([BulkSender.address, 100n], {
                account: owner.account,
            });

            await expect(
                BulkSender.write.bulkSendERC20Different([
                    AstrToken.address,
                    recipients,
                    amounts,
                ], {
                    account: owner.account,
                    value: 0n,
                })
            ).to.be.rejectedWith("BulkSender: Invalid recipient");
        });

        it("should revert when token address is zero", async function () {
            const { BulkSender, owner, recipient1 } = await loadFixture(deployTokenFixture);

            const recipients = [recipient1.account.address];
            const amounts = [100n];

            await expect(
                BulkSender.write.bulkSendERC20Different([
                    "0x0000000000000000000000000000000000000000", // Zero address
                    recipients,
                    amounts,
                ], {
                    account: owner.account,
                    value: 0n,
                })
            ).to.be.rejectedWith("BulkSender: Invalid token address");
        });
    });
});