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

// ── Keccak-256 (Ethereum standard) ───────────────────────────────────────────
// Node.js built-in crypto uses SHA3-256 (NIST), which is DIFFERENT from
// Ethereum's keccak256 (pre-NIST). We implement keccak256 manually below.
// This matches exactly what ethers.js uses on the website.

// Keccak-256 implementation (pure JS, no packages needed)
function keccak256(buffer) {
  // Keccak state
  const RATE = 136; // 1088 bits / 8
  const state = new Uint8Array(200);

  // Absorb
  let offset = 0;
  const input = buffer instanceof Uint8Array ? buffer : Buffer.from(buffer);

  let inputOffset = 0;
  while (inputOffset < input.length) {
    const blockSize = Math.min(RATE, input.length - inputOffset);
    for (let i = 0; i < blockSize; i++) {
      state[i] ^= input[inputOffset + i];
    }
    if (blockSize === RATE) {
      keccakF(state);
    }
    inputOffset += blockSize;
    if (blockSize === RATE) offset = 0; else offset = blockSize;
  }

  // Padding
  state[offset] ^= 0x01;
  state[RATE - 1] ^= 0x80;
  keccakF(state);

  return Buffer.from(state.slice(0, 32));
}

function keccakF(state) {
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808An, 0x8000000080008000n,
    0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An,
    0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];

  // Convert state bytes to 25 uint64 lanes (little-endian)
  const lanes = [];
  for (let i = 0; i < 25; i++) {
    const lo = state.slice(i * 8, i * 8 + 4);
    const hi = state.slice(i * 8 + 4, i * 8 + 8);
    lanes.push(
      (BigInt(hi[3]) << 56n) | (BigInt(hi[2]) << 48n) |
      (BigInt(hi[1]) << 40n) | (BigInt(hi[0]) << 32n) |
      (BigInt(lo[3]) << 24n) | (BigInt(lo[2]) << 16n) |
      (BigInt(lo[1]) << 8n)  |  BigInt(lo[0])
    );
  }

  const MASK = 0xFFFFFFFFFFFFFFFFn;

  for (let round = 0; round < 24; round++) {
    // θ
    const C = Array(5).fill(0n).map((_, x) =>
      lanes[x] ^ lanes[x+5] ^ lanes[x+10] ^ lanes[x+15] ^ lanes[x+20]
    );
    const D = Array(5).fill(0n).map((_, x) =>
      C[(x+4)%5] ^ rotL(C[(x+1)%5], 1n)
    );
    for (let i = 0; i < 25; i++) lanes[i] ^= D[i % 5];

    // ρ and π
    const B = new Array(25).fill(0n);
    const ROT = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        B[y * 5 + ((2*x + 3*y) % 5)] = rotL(lanes[x + 5*y], BigInt(ROT[x + 5*y]));

    // χ
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        lanes[x + 5*y] = B[x + 5*y] ^ ((~B[(x+1)%5 + 5*y]) & B[(x+2)%5 + 5*y]) & MASK;

    // ι
    lanes[0] ^= RC[round];
  }

  // Write lanes back to state
  for (let i = 0; i < 25; i++) {
    const v = lanes[i];
    for (let b = 0; b < 8; b++) {
      state[i * 8 + b] = Number((v >> BigInt(b * 8)) & 0xFFn);
    }
  }
}

function rotL(v, n) {
  return ((v << n) | (v >> (64n - n))) & 0xFFFFFFFFFFFFFFFFn;
}

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
    // Encode: bytes32(seed) + uint256(i) — same as ethers.solidityPacked on website
    const seed   = Buffer.from(BLOCK_HASH.slice(2), 'hex'); // 32 bytes
    const iBytes = Buffer.alloc(32);
    iBytes.writeBigUInt64BE(BigInt(i), 24); // uint256, big-endian (right-aligned)

    const hashBuf = keccak256(Buffer.concat([seed, iBytes]));
    const rand    = BigInt('0x' + hashBuf.toString('hex'));

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
