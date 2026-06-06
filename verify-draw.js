/**
 * ============================================================
 *  Green Beli — Lucky Holder Draw · Public Verify Script
 * ============================================================
 *
 * Anyone can run this script to independently verify the draw.
 * Same inputs → always same winners. No trust required.
 *
 * REQUIREMENTS:
 *   Node.js (nodejs.org) — free, no other packages needed
 *
 * HOW TO RUN:
 *   1. Install Node.js from nodejs.org
 *   2. Open Terminal (Mac) or Command Prompt (Windows)
 *   3. Run: node verify-draw.js
 *
 * HOW TO GET THE CSV:
 *   - Open the Google Sheet link published by Green Beli
 *   - File → Download → CSV
 *   - Save as "active-trees.csv" in the same folder as this script
 *
 * ============================================================
 */

const fs     = require('fs');
const crypto = require('crypto');

// ── FILL IN THESE VALUES (published by Green Beli before each draw) ─────────
const BLOCK_HASH   = "0x0000000000000000000000000000000000000000000000000000000000000000"; // ← paste block hash
const BLOCK_NUMBER = 0;          // ← paste block number
const NUM_WINNERS  = 5;          // ← number of winners
const CSV_FILE     = "active-trees.csv"; // ← CSV file in same folder
// ────────────────────────────────────────────────────────────────────────────

function main() {
  console.log("=".repeat(60));
  console.log("  Green Beli — Lucky Holder Draw · Verify Script");
  console.log("=".repeat(60));
  console.log();

  // ── 1. Validate inputs ────────────────────────────────────────
  if (!BLOCK_HASH.match(/^0x[0-9a-fA-F]{64}$/)) {
    console.error("❌ Invalid BLOCK_HASH. Must be 0x + 64 hex characters.");
    process.exit(1);
  }
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ File not found: ${CSV_FILE}`);
    console.error("   Download the CSV from the Google Sheet and save it here.");
    process.exit(1);
  }

  // ── 2. Load & parse CSV ───────────────────────────────────────
  const raw = fs.readFileSync(CSV_FILE, 'utf8');

  // Normalize (same as website)
  const normalized = raw
    .replace(/^\uFEFF/, '')   // remove BOM
    .replace(/\r\n/g, '\n')   // Windows line endings
    .replace(/\r/g, '\n')     // old Mac line endings
    .trim();

  // Calculate file hash for integrity check
  const fileHash = crypto.createHash('sha256').update(normalized).digest('hex');
  console.log(`📋 CSV File      : ${CSV_FILE}`);
  console.log(`🔐 File SHA-256  : ${fileHash}`);
  console.log(`   (Compare with hash published by Green Beli)`);
  console.log();

  // Parse rows: skip header, extract NFT_ID and WALLET
  const lines  = normalized.split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (i === 0 && isNaN(cols[0])) continue; // skip header
    if (cols.length < 3) continue;
    const nftId = cols[1], wallet = cols[2];
    if (!nftId || !wallet || !wallet.startsWith('0x')) continue;
    entries.push({ nftId, wallet });
  }

  console.log(`🌳 Total entries : ${entries.length} NFT IDs`);
  console.log(`⛓  Block number  : ${BLOCK_NUMBER}`);
  console.log(`🔑 Block hash    : ${BLOCK_HASH.slice(0,20)}...`);
  console.log(`🏆 Winners       : ${NUM_WINNERS}`);
  console.log();

  if (entries.length < NUM_WINNERS) {
    console.error(`❌ Not enough entries (${entries.length}) for ${NUM_WINNERS} winners.`);
    process.exit(1);
  }

  // ── 3. Fisher-Yates shuffle seeded by block hash ──────────────
  const pool = [...entries];
  const N    = pool.length;

  for (let i = 0; i < NUM_WINNERS; i++) {
    // rand_i = keccak256(blockHash + i)  — same as website
    const seed  = Buffer.from(BLOCK_HASH.slice(2), 'hex'); // 32 bytes
    const iBytes = Buffer.alloc(32);
    iBytes.writeBigUInt64BE(BigInt(i), 24); // uint256, big-endian

    const rand  = BigInt('0x' + crypto.createHash('sha3-256')
      .update(Buffer.concat([seed, iBytes]))
      .digest('hex'));

    const j = Number(rand % BigInt(N - i)) + i;

    // Swap
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const winners = pool.slice(0, NUM_WINNERS);

  // ── 4. Print results ──────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("  RESULTS");
  console.log("=".repeat(60));
  const medals = ['🥇', '🥈', '🥉', '4 ', '5 ', '6 ', '7 ', '8 ', '9 ', '10'];
  winners.forEach((w, i) => {
    console.log(`${medals[i] || (i+1)} NFT #${w.nftId.padEnd(8)} → ${w.wallet}`);
  });
  console.log("=".repeat(60));
  console.log();
  console.log("✅ Verification complete.");
  console.log("   If these match the announced results → draw was fair.");
}

main();
