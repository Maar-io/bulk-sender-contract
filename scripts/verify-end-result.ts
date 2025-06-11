
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface StartBalanceEntry {
  address: string;
  startBalance: bigint;
}

interface EndBalanceEntry {
  address: string;
  endBalance: bigint;
}

interface RecipientEntry {
  address: string;
  expectedAmount: bigint;
}

interface VerificationResult {
  address: string;
  startBalance: bigint;
  expectedAmount: bigint;
  endBalance: bigint;
  calculatedEnd: bigint;
  matches: boolean;
  difference?: bigint;
}

async function loadStartBalances(csvPath: string): Promise<Map<string, bigint>> {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    skip_empty_lines: true,
    trim: true,
  });

  const balanceMap = new Map<string, bigint>();
  
  for (const record of records) {
    const address = record[0];
    const balance = BigInt(record[1]);
    balanceMap.set(address.toLowerCase(), balance);
  }
  
  return balanceMap;
}

async function loadEndBalances(csvPath: string): Promise<Map<string, bigint>> {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    skip_empty_lines: true,
    trim: true,
    from_line: 2, // Skip header
  });

  const balanceMap = new Map<string, bigint>();
  
  for (const record of records) {
    const address = record[0];
    const balance = BigInt(record[1]);
    balanceMap.set(address.toLowerCase(), balance);
  }
  
  return balanceMap;
}

async function loadRecipients(csvPath: string): Promise<Map<string, bigint>> {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    skip_empty_lines: true,
    trim: true,
  });

  const recipientMap = new Map<string, bigint>();
  
  for (const record of records) {
    const address = record[0];
    const amount = BigInt(record[1].replace(/,/g, '')); // Remove commas
    recipientMap.set(address.toLowerCase(), amount);
  }
  
  return recipientMap;
}

function verifyTransfers(
  startBalances: Map<string, bigint>,
  endBalances: Map<string, bigint>,
  recipients: Map<string, bigint>
): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  // Check all addresses that received transfers
  for (const [address, expectedAmount] of recipients) {
    const startBalance = startBalances.get(address) || 0n;
    const endBalance = endBalances.get(address) || 0n;
    const calculatedEnd = startBalance + expectedAmount;
    const matches = endBalance === calculatedEnd;
    const difference = matches ? undefined : endBalance - calculatedEnd;
    
    results.push({
      address,
      startBalance,
      expectedAmount,
      endBalance,
      calculatedEnd,
      matches,
      difference,
    });
  }
  
  return results;
}

function generateReport(results: VerificationResult[]) {
  const matches = results.filter(r => r.matches);
  const mismatches = results.filter(r => !r.matches);
  
  console.log('📊 TRANSFER VERIFICATION REPORT');
  console.log('='.repeat(80));
  console.log(`Total addresses verified: ${results.length}`);
  console.log(`✅ Matching transfers: ${matches.length}`);
  console.log(`❌ Mismatched transfers: ${mismatches.length}`);
  console.log(`Success rate: ${((matches.length / results.length) * 100).toFixed(2)}%\n`);
  
  if (mismatches.length > 0) {
    console.log('❌ MISMATCHED TRANSFERS:');
    console.log('-'.repeat(120));
    console.log('Address'.padEnd(42) + 'Start Balance'.padEnd(20) + 'Expected Amount'.padEnd(20) + 'End Balance'.padEnd(20) + 'Calculated End'.padEnd(20) + 'Difference');
    console.log('-'.repeat(120));
    
    mismatches.slice(0, 20).forEach(result => { // Show first 20 mismatches
      const start = result.startBalance.toString().padEnd(20);
      const expected = result.expectedAmount.toString().padEnd(20);
      const end = result.endBalance.toString().padEnd(20);
      const calculated = result.calculatedEnd.toString().padEnd(20);
      const diff = (result.difference || 0n).toString();
      
      console.log(
        result.address.padEnd(42) +
        start +
        expected +
        end +
        calculated +
        diff
      );
    });
    
    if (mismatches.length > 20) {
      console.log(`... and ${mismatches.length - 20} more mismatches`);
    }
  }
  
  if (matches.length > 0) {
    console.log('\n✅ SAMPLE SUCCESSFUL TRANSFERS:');
    console.log('-'.repeat(120));
    console.log('Address'.padEnd(42) + 'Start Balance'.padEnd(20) + 'Expected Amount'.padEnd(20) + 'End Balance'.padEnd(20));
    console.log('-'.repeat(120));
    
    matches.slice(0, 10).forEach(result => { // Show first 10 successful transfers
      const start = result.startBalance.toString().padEnd(20);
      const expected = result.expectedAmount.toString().padEnd(20);
      const end = result.endBalance.toString().padEnd(20);
      
      console.log(
        result.address.padEnd(42) +
        start +
        expected +
        end
      );
    });
  }
  
  console.log('\n✅ SUMMARY:');
  if (mismatches.length === 0) {
    console.log('🎉 All transfers verified successfully!');
    console.log('Formula: start_balance + expected_amount = end_balance ✓');
  } else {
    console.log(`⚠️  ${mismatches.length} transfers have discrepancies`);
    console.log('Formula: start_balance + expected_amount ≠ end_balance');
    
    // Calculate total discrepancy
    const totalDiscrepancy = mismatches.reduce((sum, result) => {
      return sum + (result.difference || 0n);
    }, 0n);
    
    console.log(`Total discrepancy: ${totalDiscrepancy} wei`);
  }
}

async function main() {
  try {
    const dataDir = path.join(__dirname, '../data');
    const startBalancesPath = path.join(dataDir, 'start_balances_soneium.csv');
    const endBalancesPath = path.join(dataDir, 'end.csv');
    const recipientsPath = path.join(dataDir, 'recipients.csv');
    
    // Check if files exist
    const files = [
      { path: startBalancesPath, name: 'start_balances_soneium.csv' },
      { path: endBalancesPath, name: 'end.csv' },
      { path: recipientsPath, name: 'recipients.csv' }
    ];
    
    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        throw new Error(`File not found: ${file.name}`);
      }
    }
    
    console.log('📁 Loading CSV files...');
    console.log(`📄 Start balances: ${startBalancesPath}`);
    console.log(`📄 End balances: ${endBalancesPath}`);
    console.log(`📄 Recipients: ${recipientsPath}\n`);
    
    // Load all data
    const [startBalances, endBalances, recipients] = await Promise.all([
      loadStartBalances(startBalancesPath),
      loadEndBalances(endBalancesPath),
      loadRecipients(recipientsPath)
    ]);
    
    console.log(`✅ Loaded ${startBalances.size} start balances`);
    console.log(`✅ Loaded ${endBalances.size} end balances`);
    console.log(`✅ Loaded ${recipients.size} recipient entries\n`);
    
    // Verify transfers
    console.log('🔍 Verifying transfers...');
    const results = verifyTransfers(startBalances, endBalances, recipients);
    
    // Generate report
    generateReport(results);
    
    // Save detailed results
    const outputPath = path.join(dataDir, 'transfer_verification_results.json');
    const jsonResults = results.map(result => ({
      ...result,
      startBalance: result.startBalance.toString(),
      expectedAmount: result.expectedAmount.toString(),
      endBalance: result.endBalance.toString(),
      calculatedEnd: result.calculatedEnd.toString(),
      difference: result.difference?.toString() || null,
    }));
    
    fs.writeFileSync(outputPath, JSON.stringify(jsonResults, null, 2));
    console.log(`\n📄 Detailed results saved to: transfer_verification_results.json`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);