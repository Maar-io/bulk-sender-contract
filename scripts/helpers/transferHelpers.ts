import { TransferData } from "../../test/helpers";
import { checkTokenBalance, checkTokenAllowance } from "./contractHelpers";
import hre from "hardhat";

export async function processTransferBatches(
  batches: TransferData[][],
  tokenContract: any,
  bulkSenderContract: any,
  signer: any
) {
  const totalAmount = batches.flat().reduce((sum, entry) => sum + entry.amount, 0n);
  console.log(`📊 Total amount to transfer: ${totalAmount}`);

  await checkTokenBalance(tokenContract, signer, totalAmount);
  await checkTokenAllowance(tokenContract, signer, bulkSenderContract.address, totalAmount);

  console.log(`\n🚀 Processing ${batches.length} batches...`);

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

  console.log(`💰 Batch total: ${batchTotal}`);

  // Pre-select verification addresses and store only those balances
  const verificationData = await prepareVerificationData(recipients, amounts, tokenContract);

  try {
    // 1. Simulate the transaction
    console.log("🔍 Simulating transaction...");
    await bulkSenderContract.simulate.bulkSendERC20Different([
      tokenContract.address,
      recipients,
      amounts,
    ], { account: signer.account });

    console.log("✅ Simulation successful");

    // 2. Estimate gas
    console.log("⛽ Estimating gas...");
    const gasEstimate = await bulkSenderContract.estimateGas.bulkSendERC20Different([
      tokenContract.address,
      recipients,
      amounts,
    ], { account: signer.account });

    console.log(`📊 Estimated gas: ${gasEstimate}`);

    // 3. Execute the transaction
    // console.log("📤 Executing transaction...");
    // const hash = await bulkSenderContract.write.bulkSendERC20Different([
    //   tokenContract.address,
    //   recipients,
    //   amounts,
    // ], { 
    //   account: signer.account,
    //   gas: gasEstimate + (gasEstimate / 10n) // Add 10% buffer
    // });

    // console.log(`🎉 Batch ${batchNumber} transaction sent: ${hash}`);
    console.log(`🎉 Batch ${batchNumber} sent`);
    
    // Wait for confirmation and verify transfers
    await verifyBatchTransfers(verificationData, tokenContract, batchNumber);
    
  } catch (error: any) {
    console.error(`❌ Batch ${batchNumber} failed:`, error.shortMessage || error.message);
    throw error;
  }
}

interface VerificationEntry {
  address: `0x${string}`;
  expectedAmount: bigint;
  initialBalance: bigint;
}

async function prepareVerificationData(
  recipients: `0x${string}`[],
  amounts: bigint[],
  tokenContract: any
): Promise<VerificationEntry[]> {
  // Calculate 10% of recipients, minimum 1, maximum 10 for fast verification
  const tenPercent = Math.ceil(recipients.length * 0.1);
  const samplesToCheck = Math.max(1, Math.min(tenPercent, 10));
  
  console.log(`📋 Pre-selecting ${samplesToCheck} addresses for verification (${Math.round((samplesToCheck / recipients.length) * 100)}% of batch)...`);
  
  const verificationData: VerificationEntry[] = [];
  const selectedIndexes = new Set<number>();
  
  // Randomly select unique indexes
  while (selectedIndexes.size < samplesToCheck) {
    const randomIndex = Math.floor(Math.random() * recipients.length);
    selectedIndexes.add(randomIndex);
  }
  
  // Get initial balances only for selected addresses
  for (const index of selectedIndexes) {
    const address = recipients[index];
    const balance = await tokenContract.read.balanceOf([address]);
    
    verificationData.push({
      address,
      expectedAmount: amounts[index],
      initialBalance: balance
    });
  }
  
  return verificationData;
}

async function verifyBatchTransfers(
  verificationData: VerificationEntry[],
  tokenContract: any,
  batchNumber: number
) {
  console.log(`🔍 Verifying ${verificationData.length} pre-selected recipients...`);
  
  for (const entry of verificationData) {
    const currentBalance = await tokenContract.read.balanceOf([entry.address]);
    const actualIncrease = currentBalance - entry.initialBalance;
    
    if (actualIncrease === entry.expectedAmount) {
      console.log(`✅ ${entry.address}: ${entry.initialBalance} → ${currentBalance} (+${actualIncrease})`);
    } else {
      console.log(`❌ ${entry.address}: Expected +${entry.expectedAmount}, Got +${actualIncrease}`);
      throw new Error(`Transfer verification failed for ${entry.address}`);
    }
  }
  
  console.log(`✅ Batch ${batchNumber} verification completed successfully`);
}