import hre from "hardhat";
import * as path from "path";
import { loadCSVData, logCSVInfo, createBatches } from "../test/helpers";
import { getContractInstances, validateEnvironment } from "./helpers/contractHelpers";
import { processTransferBatches } from "./helpers/transferHelpers";

async function main() {
  const config = {
    tokenAddress: process.env.TOKEN_ADDRESS || "",
    bulkSenderAddress: process.env.BULK_SENDER_ADDRESS || "",
    csvFile: process.env.CSV_FILE || "recipients.csv",
    batchSize: parseInt(process.env.BATCH_SIZE || "200"),
  };

  await validateEnvironment(config);
  
  const csvPath = path.join(__dirname, "../data", config.csvFile);
  const csvData = loadCSVData(csvPath);
  logCSVInfo(csvData);

  const { tokenContract, bulkSenderContract, signer } = await getContractInstances(
    config.tokenAddress,
    config.bulkSenderAddress
  );

  console.log(`Using signer: ${signer.account.address}`);
  console.log(`Network: ${hre.network.name}`);

  const batches = createBatches(csvData, config.batchSize);
  await processTransferBatches(batches, tokenContract, bulkSenderContract, signer);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});