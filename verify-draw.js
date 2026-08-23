/**
 * ============================================================
 *  Green Beli — Lucky Holder Draw · Public Verify Script
 * ============================================================
 *
 * REQUIREMENTS:
 *   Node.js (nodejs.org) — free
 *   Run once: npm install   (installs ethers@6.9.0, pinned in package.json to
 *                            match the exact version used on the website —
 *                            do NOT run "npm install ethers" without the
 *                            version pin, a newer major version may change
 *                            keccak256/solidityPacked behavior and produce
 *                            different winners than the website)
 *
 * HOW TO RUN:
 *   1. Install Node.js from nodejs.org
 *   2. Open Terminal / Command Prompt in this folder (must contain
 *      package.json alongside this script)
 *   3. Run: npm install
 *   4. Run: node verify-draw.js
 *   5. Follow the prompts
 *
 * HOW TO GET THE CSV:
 *   - Open the Google Sheet link published by Green Beli
 *   - File → Download → Comma Separated Values (.csv)
 *   - Save as "active-trees.csv" in the same folder as this script
 *
 * ============================================================
 */

const fs       = require('fs');
const crypto   = require('crypto');
const readline = require('readline');
const ethers   = require('ethers');

// ── Prompt helper ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise(resolve => rl.question(question, resolve));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log("=".repeat(60));
  console.log("  Green Beli — Lucky Holder Draw · Verify Script");
  console.log("=".repeat(60));
  console.log();

  // ── 1. Ask for inputs ─────────────────────────────────────────
  const blockHash = (await ask("  Enter Block Hash   : ")).trim();
  if (!blockHash.match(/^0x[0-9a-fA-F]{64}$/)) {
    console.error("\n❌ Invalid Block Hash. Must start with 0x and be 64 hex characters.");
    rl.close(); process.exit(1);
  }

  const blockNumRaw = (await ask("  Enter Block Number : ")).trim();
  const blockNumber = parseInt(blockNumRaw);
  if (isNaN(blockNumber)) {
    console.error("\n❌ Invalid Block Number.");
    rl.close(); process.exit(1);
  }

  const numWinnersRaw = (await ask("  Number of Winners  : ")).trim();
  const numWinners = parseInt(numWinnersRaw);
  if (isNaN(numWinners) || numWinners < 1) {
    console.error("\n❌ Invalid number of winners.");
    rl.close(); process.exit(1);
  }

  const csvFile = (await ask("  CSV filename       : [active-trees.csv] ")).trim() || "active-trees.csv";
  rl.close();

  console.log();
  console.log("─".repeat(60));

  // ── 2. Load & parse CSV ───────────────────────────────────────
  if (!fs.existsSync(csvFile)) {
    console.error(`\n❌ File not found: "${csvFile}"`);
    console.error("   Download CSV from the Google Sheet and save it here.");
    process.exit(1);
  }

  const raw = fs.readFileSync(csvFile, 'utf8');

  // Normalize — same as website
  const normalized = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // SHA-256 for integrity check
  const fileHash = crypto.createHash('sha256').update(normalized).digest('hex');

  // Parse rows — preserve original CSV order, no sorting
  const lines   = normalized.split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (i === 0 && isNaN(cols[0])) continue;
    if (cols.length < 3) continue;
    const nftId  = cols[1];
    const wallet = cols[2];
    if (!nftId || !wallet || !wallet.startsWith('0x')) continue;
    entries.push({ nftId, wallet });
  }

  console.log();
  console.log(`📋 CSV File      : ${csvFile}`);
  console.log(`🔐 File SHA-256  : ${fileHash}`);
  console.log(`   Compare with hash published by Green Beli to verify file integrity`);
  console.log();
  console.log(`🌳 Total entries : ${entries.length} NFT IDs`);
  console.log(`⛓  Block number  : ${blockNumber}`);
  console.log(`🔑 Block hash    : ${blockHash.slice(0, 20)}...`);
  console.log(`🏆 Winners       : ${numWinners}`);
  console.log();

  if (entries.length < numWinners) {
    console.error(`❌ Not enough entries (${entries.length}) for ${numWinners} winners.`);
    process.exit(1);
  }

  // ── 3. Fisher-Yates seeded with keccak256 (same as website) ──
  const pool = [...entries];
  const N    = pool.length;

  for (let i = 0; i < numWinners; i++) {
    const encoded = ethers.solidityPacked(['bytes32', 'uint256'], [blockHash, i]);
    const rand    = BigInt(ethers.keccak256(encoded));
    const j       = Number(rand % BigInt(N - i)) + i;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const winners = pool.slice(0, numWinners);

  // ── 4. Print results ──────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("  RESULTS");
  console.log("=".repeat(60));
  const medals = ['🥇', '🥈', '🥉', '4 ', '5 ', '6 ', '7 ', '8 ', '9 ', '10'];
  winners.forEach((w, i) => {
    console.log(`${medals[i] || (i + 1)} NFT #${w.nftId.padEnd(8)} → ${w.wallet}`);
  });
  console.log("=".repeat(60));
  console.log();
  console.log("✅ Verification complete.");
  console.log("   If these match the announced results → draw was fair.");
  console.log();
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
