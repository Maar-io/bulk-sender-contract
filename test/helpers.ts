import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployTokenFixture } from "./fixture";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";

export interface TransferData {
  address: string;
  amount: bigint;
}

function parseWeiAmount(amountString: string): bigint {
  // Remove quotes and whitespace
  let cleaned = amountString.replace(/["'\s]/g, '');
  
  // Remove thousands separators (commas)
  cleaned = cleaned.replace(/,/g, '');
  
  // Validate format
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`Invalid amount format: ${amountString}`);
  }
  
  return BigInt(cleaned);
}

function validateAndParseRow(row: any, index: number): TransferData {
  const address = Array.isArray(row) ? row[0]?.trim() : row.address?.trim();
  const amountString = Array.isArray(row) ? row[1]?.trim() : row.amount?.trim();

  if (!address || !amountString) {
    throw new Error(`Invalid row ${index + 1}: missing address or amount`);
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid address format at row ${index + 1}: ${address}`);
  }

  // Convert amount to bigint
  let amount: bigint;
  try {
    amount = parseWeiAmount(amountString);
  } catch (error) {
    throw new Error(`Invalid amount at row ${index + 1}: ${amountString} - ${error}`);
  }

  if (amount <= 0n) {
    throw new Error(`Amount must be positive at row ${index + 1}: ${amount}`);
  }

  return { address, amount };
}

export function loadCSVData(csvPath: string): TransferData[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  
  const parsed = Papa.parse(csvContent, {
    header: false, // No headers in your CSV format
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing errors: ${JSON.stringify(parsed.errors)}`);
  }

  return parsed.data.map((row: any, index: number) => 
    validateAndParseRow(row, index)
  );
}

export function logCSVInfo(csvData: TransferData[]): void {
  console.log(`Loaded ${csvData.length} entries from CSV`);
  
  // Log first few entries for verification
  console.log("First 3 entries:");
  csvData.slice(0, 3).forEach((entry, index) => {
    console.log(`  ${index + 1}: ${entry.address} -> ${entry.amount.toString()} wei`);
  });
}

export function createBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

export async function storeInitialBalances(
  recipients: `0x${string}`[], 
  AstrToken: any, 
  balanceMap: Map<string, bigint>
): Promise<void> {
  for (const recipient of recipients) {
    if (!balanceMap.has(recipient)) {
      const balance = await AstrToken.read.balanceOf([recipient]);
      balanceMap.set(recipient, balance);
    }
  }
}

export async function verifyRandomSamples(
  recipients: `0x${string}`[],
  amounts: bigint[],
  initialBalances: Map<string, bigint>,
  AstrToken: any
): Promise<void> {
  const samplesToCheck = Math.min(5, recipients.length);
  for (let j = 0; j < samplesToCheck; j++) {
    const randomIndex = Math.floor(Math.random() * recipients.length);
    const recipient = recipients[randomIndex];
    const expectedAmount = amounts[randomIndex];
    const initialBalance = initialBalances.get(recipient) || 0n;
    
    const currentBalance = await AstrToken.read.balanceOf([recipient]);
    expect(currentBalance).to.equal(initialBalance + expectedAmount);
  }
}