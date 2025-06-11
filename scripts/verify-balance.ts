import { createPublicClient, http, formatUnits } from 'viem';
import { soneiumMinato } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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

interface BalanceResult {
  address: string;
  expectedAmount: bigint;
  actualBalance: bigint;
  matches: boolean;
  difference?: bigint;
}

const TEST_ERC20_ADDRESS = "0x8036Ccb4dDdab20aDB595418EC2089B1f533c9fE";

async function loadCSVData(csvPath: string): Promise<CSVEntry[]> {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: string[]) => ({
    address: record[0],
    expectedAmount: BigInt(record[1].replace(/,/g, '')), // Remove commas from numbers
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

async function verifyBalancesInBatches(
  entries: CSVEntry[],
  batchSize: number = 50
): Promise<BalanceResult[]> {
  const client = createPublicClient({
    chain: soneiumMinato,
    transport: http(),
  });

  console.log(`🔗 Connected to ${soneiumMinato.name}`);
  console.log(`📊 Token contract: ${TEST_ERC20_ADDRESS}`);
  
  // Get token info
  const tokenInfo = await getTokenInfo(client, TEST_ERC20_ADDRESS);
  console.log(`💰 Token: ${tokenInfo.symbol} (${tokenInfo.decimals} decimals)`);
  console.log(`📋 Verifying ${entries.length} addresses in batches of ${batchSize}...\n`);

  const results: BalanceResult[] = [];
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
      const actualBalance = await checkBalance(client, TEST_ERC20_ADDRESS, entry.address);
      const matches = actualBalance === entry.expectedAmount;
      const difference = matches ? undefined : actualBalance - entry.expectedAmount;

      return {
        address: entry.address,
        expectedAmount: entry.expectedAmount,
        actualBalance,
        matches,
        difference,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Log progress
    const matchCount = batchResults.filter(r => r.matches).length;
    console.log(`✅ Batch complete: ${matchCount}/${batchResults.length} matches\n`);
  }

  return results;
}

function generateReport(results: BalanceResult[], tokenDecimals: number) {
  const matches = results.filter(r => r.matches);
  const mismatches = results.filter(r => !r.matches);

  console.log('📊 VERIFICATION REPORT');
  console.log('='.repeat(50));
  console.log(`Total addresses checked: ${results.length}`);
  console.log(`✅ Matching balances: ${matches.length}`);
  console.log(`❌ Mismatched balances: ${mismatches.length}`);
  console.log(`Success rate: ${((matches.length / results.length) * 100).toFixed(2)}%\n`);

  if (mismatches.length > 0) {
    console.log('❌ MISMATCHED BALANCES:');
    console.log('-'.repeat(100));
    console.log('Address'.padEnd(42) + 'Expected'.padEnd(25) + 'Actual'.padEnd(25) + 'Difference');
    console.log('-'.repeat(100));

    mismatches.slice(0, 20).forEach(result => { // Show first 20 mismatches
      const expected = formatUnits(result.expectedAmount, tokenDecimals);
      const actual = formatUnits(result.actualBalance, tokenDecimals);
      const diff = result.difference ? formatUnits(result.difference, tokenDecimals) : '0';
      
      console.log(
        result.address.padEnd(42) +
        expected.padEnd(25) +
        actual.padEnd(25) +
        diff
      );
    });

    if (mismatches.length > 20) {
      console.log(`... and ${mismatches.length - 20} more mismatches`);
    }
  }

  console.log('\n✅ SUMMARY:');
  if (mismatches.length === 0) {
    console.log('🎉 All balances match perfectly!');
  } else {
    console.log(`⚠️  ${mismatches.length} addresses have balance mismatches`);
  }
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

    // Verify balances
    const results = await verifyBalancesInBatches(entries, 50);

    // Get token decimals for report
    const client = createPublicClient({
      chain: soneiumMinato,
      transport: http(),
    });
    const tokenInfo = await getTokenInfo(client, TEST_ERC20_ADDRESS);

    // Generate report
    generateReport(results, tokenInfo.decimals);

    // Save detailed results to file
    const outputPath = path.join(__dirname, '../data/balance_verification_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2));
    console.log(`\n📄 Detailed results saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);