import hre from "hardhat";
import ERC20Artifact from "../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import BulkSenderArtifact from "../../artifacts/contracts/BulkSender.sol/BulkSender.json";

export async function getContractInstances(tokenAddress: string, bulkSenderAddress: string) {
  const [signer] = await hre.viem.getWalletClients();
  
  const tokenContract = await hre.viem.getContractAt(
    JSON.stringify(ERC20Artifact.abi),
    tokenAddress as `0x${string}`);


  const bulkSenderContract = await hre.viem.getContractAt(
    JSON.stringify(BulkSenderArtifact.abi),
    bulkSenderAddress as `0x${string}`);

  return { tokenContract, bulkSenderContract, signer };
}

export async function validateEnvironment(config: any) {
  if (!config.tokenAddress) {
    throw new Error("TOKEN_ADDRESS environment variable is required");
  }
  
  if (!config.bulkSenderAddress) {
    throw new Error("BULK_SENDER_ADDRESS environment variable is required");
  }

  console.log(`Token: ${config.tokenAddress}`);
  console.log(`BulkSender: ${config.bulkSenderAddress}`);
  console.log(`Batch size: ${config.batchSize}`);
  console.log(`CSV file: ${config.csvFile}`);
}

export async function checkTokenBalance(tokenContract: any, signer: any, requiredAmount: bigint) {
  const balance = await tokenContract.read.balanceOf([signer.account.address]);
  
  if (balance < requiredAmount) {
    throw new Error(
      `Insufficient token balance. Required: ${requiredAmount}, Available: ${balance}`
    );
  }
  
  console.log(`✅ Token balance: ${balance}`);
  return balance;
}

export async function checkTokenAllowance(
  tokenContract: any, 
  signer: any, 
  spender: string, 
  requiredAmount: bigint
) {
  const currentAllowance = await tokenContract.read.allowance([signer.account.address, spender]);
  console.log(`Current allowance: ${currentAllowance}`);
  
  if (currentAllowance < requiredAmount) {
    console.log(`🔄 Insufficient allowance. Approving ${requiredAmount} tokens for BulkSender...`);
    
    // If there's existing allowance, reset to 0 first (for tokens like USDT)
    if (currentAllowance > 0n) {
      console.log("🔄 Resetting existing allowance to 0...");
      const resetHash = await tokenContract.write.approve([spender, 0n], {
        account: signer.account
      });
      console.log(`Reset approval transaction: ${resetHash}`);
      
      // Wait for reset confirmation
      await waitForTransactionConfirmation(resetHash);
    }
    
    // Set new approval
    const approvalHash = await tokenContract.write.approve([spender, requiredAmount], {
      account: signer.account
    });
    console.log(`Approval transaction: ${approvalHash}`);
    
    // Wait for approval confirmation
    await waitForTransactionConfirmation(approvalHash);
    
    // Verify the approval was successful
    const newAllowance = await tokenContract.read.allowance([signer.account.address, spender]);
    if (newAllowance < requiredAmount) {
      throw new Error(`Approval failed. Expected: ${requiredAmount}, Got: ${newAllowance}`);
    }
    
    console.log(`✅ Approval successful. New allowance: ${newAllowance}`);
  } else {
    console.log(`✅ Sufficient allowance already exists: ${currentAllowance}`);
  }
  
  return currentAllowance;
}

async function waitForTransactionConfirmation(hash: string) {
  console.log(`⏳ Waiting for transaction ${hash} to be confirmed...`);
  
  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: hash as `0x${string}`,
    confirmations: 1
  });
  
  if (receipt.status === 'reverted') {
    throw new Error(`Transaction ${hash} was reverted`);
  }
  
  console.log(`✅ Transaction ${hash} confirmed in block ${receipt.blockNumber}`);
  return receipt;
}