import { createPublicClient, http, formatUnits } from 'viem';
import { soneium } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// ERC20 ABI (minimal)
const erc20Abi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface CSVEntry {
  address: string;
  expectedAmount: bigint;
}

interface BalanceEntry {
  address: string;
  currentBalance: string; // Formatted balance as string for CSV
}

const ASTR = "0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441";

async function loadCSVData(csvPath: string): Promise<CSVEntry[]> {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: string[]) => ({
    address: record[0],
    expectedAmount: BigInt(record[1].replace(/,/g, '')), // We still load this but won't use it
  }));
}

async function checkBalance(
  client: any,
  tokenAddress: string,
  address: string
): Promise<bigint> {
  try {
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return balance;
  } catch (error) {
    console.error(`Error reading balance for ${address}:`, error);
    return 0n;
  }
}

async function getTokenInfo(client: any, tokenAddress: string) {
  try {
    const [decimals, symbol] = await Promise.all([
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ]);
    return { decimals, symbol };
  } catch (error) {
    console.error('Error getting token info:', error);
    return { decimals: 18, symbol: 'TOKEN' };
  }
}

async function readBalancesInBatches(
  entries: CSVEntry[],
  tokenDecimals: number,
  batchSize: number = 50
): Promise<BalanceEntry[]> {
  const client = createPublicClient({
    chain: soneium,
    transport: http(),
  });

  console.log(`🔗 Connected to ${soneium.name}`);
  console.log(`📊 Token contract: ${ASTR}`);
  console.log(`📋 Reading balances for ${entries.length} addresses in batches of ${batchSize}...\n`);

  const results: BalanceEntry[] = [];
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} addresses)...`);

    // Process batch in parallel
    const batchPromises = batch.map(async (entry) => {
      const balance = await checkBalance(client, ASTR, entry.address);
      // Remove formatUnits - keep raw wei value
      const rawBalance = balance.toString();

      return {
        address: entry.address,
        currentBalance: rawBalance, // Raw wei as string
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`✅ Batch ${batchIndex + 1} complete`);
  }

  return results;
}

function saveToCSV(balances: BalanceEntry[], outputPath: string) {
  const csvData = stringify(balances, {
    header: true,
    columns: [
      { key: 'address', header: 'address' },
      { key: 'currentBalance', header: 'current_balance' },
    ],
  });

  fs.writeFileSync(outputPath, csvData);
  console.log(`💾 Balance data saved to: ${outputPath}`);
}

async function main() {
  try {
    const csvPath = path.join(__dirname, '../data/recipients.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    console.log('📁 Loading CSV data...');
    const entries = await loadCSVData(csvPath);
    console.log(`✅ Loaded ${entries.length} entries from CSV\n`);

    // Get token info
    const client = createPublicClient({
      chain: soneium,
      transport: http(),
    });
    const tokenInfo = await getTokenInfo(client, ASTR);
    console.log(`💰 Token: ${tokenInfo.symbol} (${tokenInfo.decimals} decimals)\n`);

    // Read all balances
    const balances = await readBalancesInBatches(entries, tokenInfo.decimals, 50);

    // Save to new CSV file
    const outputPath = path.join(__dirname, '../data/current_balances.csv');
    saveToCSV(balances, outputPath);

    console.log('\n✅ SUMMARY:');
    console.log(`📊 Successfully read ${balances.length} balances`);
    console.log(`📄 Output saved to: current_balances.csv`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);