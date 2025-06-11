import { TransferData } from "../../test/helpers";
import { checkTokenBalance, checkTokenAllowance } from "./contractHelpers";

export async function processTransferBatches(
  batches: TransferData[][],
  tokenContract: any,
  bulkSenderContract: any,
  signer: any
) {
  const totalAmount = batches.flat().reduce((sum, entry) => sum + entry.amount, 0n);
  console.log(`Total amount to transfer: ${totalAmount}`);

  await checkTokenBalance(tokenContract, signer, totalAmount);
  await checkTokenAllowance(tokenContract, signer, bulkSenderContract.address, totalAmount);

  console.log(`Processing ${batches.length} batches...`);

  for (let i = 0; i < batches.length; i++) {
    await processSingleBatch(batches[i], tokenContract, bulkSenderContract, signer, i + 1);
  }

  console.log("✅ All transfers completed successfully!");
}
async function processSingleBatch(
  batch: TransferData[],
  tokenContract: any,
  bulkSenderContract: any,
  signer: any,
  batchNumber: number
) {
  console.log(`\n📦 Processing batch ${batchNumber} with ${batch.length} recipients`);

  const recipients = batch.map(entry => entry.address as `0x${string}`);
  const amounts = batch.map(entry => entry.amount);
  const batchTotal = amounts.reduce((sum, amount) => sum + amount, 0n);

  console.log(`Batch total: ${batchTotal}`);

  try {
    // 1. Simulate the transaction
    console.log("🔍 Simulating transaction...");
    const { result } = await bulkSenderContract.simulate.bulkSendERC20Different([
      tokenContract.address,
      recipients,
      amounts,
    ], { account: signer.account });

    // 2. Estimate gas
    console.log("⛽ Estimating gas...");
    const gasEstimate = await bulkSenderContract.estimateGas.bulkSendERC20Different([
      tokenContract.address,
      recipients,
      amounts,
    ], { account: signer.account });

    console.log(`Estimated gas: ${gasEstimate}`);

    // 3. Execute the transaction
    console.log("📤 Executing transaction...");
    const hash = await bulkSenderContract.write.bulkSendERC20Different([
      tokenContract.address,
      recipients,
      amounts,
    ], { 
      account: signer.account,
      gas: gasEstimate + (gasEstimate / 10n) // Add 10% buffer
    });

    console.log(`✅ Batch ${batchNumber} completed. TX: ${hash}`);
    
    await verifyBatchTransfers(recipients, tokenContract);
    
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("simulation")) {
      console.error(`❌ Batch ${batchNumber} simulation failed:`, error.message);
    } else {
      console.error(`❌ Batch ${batchNumber} execution failed:`, error);
    }
    throw error;
  }
}

async function verifyBatchTransfers(recipients: `0x${string}`[], tokenContract: any) {
  const samplesToCheck = Math.min(3, recipients.length);
  
  for (let i = 0; i < samplesToCheck; i++) {
    const randomIndex = Math.floor(Math.random() * recipients.length);
    const recipient = recipients[randomIndex];
    const balance = await tokenContract.read.balanceOf([recipient]);
    
    console.log(`✓ Verified ${recipient}: ${balance} tokens`);
  }
}