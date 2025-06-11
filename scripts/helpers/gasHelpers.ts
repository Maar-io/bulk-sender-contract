export async function estimateGasCosts(
  bulkSenderContract: any,
  tokenAddress: string,
  recipients: `0x${string}`[],
  amounts: bigint[],
  signer: any
) {
  try {
    const gasEstimate = await bulkSenderContract.estimateGas.bulkSendERC20Different([
      tokenAddress,
      recipients,
      amounts,
    ], { account: signer.account });

    console.log(`Estimated gas: ${gasEstimate}`);
    return gasEstimate;
    
  } catch (error) {
    console.warn("Could not estimate gas:", error);
    return null;
  }
}

export function calculateGasCosts(gasEstimate: bigint, gasPrice: bigint): bigint {
  return gasEstimate * gasPrice;
}

export async function checkEthBalance(signer: any, estimatedGasCost: bigint) {
  const balance = await signer.getBalance();
  
  if (balance < estimatedGasCost) {
    console.warn(`⚠️  Low ETH balance. Required: ${estimatedGasCost}, Available: ${balance}`);
  }
  
  return balance;
}