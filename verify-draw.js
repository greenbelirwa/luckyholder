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

// ── Rule 1: ticket cap per wallet ─────────────────────────────────────────────
// Keeps the first `maxTickets` NFTs of each wallet in CSV order.
// MUST stay identical to applyTicketCap() in index.html.
function applyTicketCap(entries, maxTickets) {
  const held = {}, tickets = [];
  for (const e of entries) {
    const w = e.wallet.toLowerCase();
    held[w] = (held[w] || 0) + 1;
    if (held[w] <= maxTickets) tickets.push(e);
  }
  const capped = Object.entries(held)
    .filter(([, n]) => n > maxTickets)
    .map(([wallet, n]) => ({ wallet, held: n }))
    .sort((a, b) => b.held - a.held);
  return { tickets, capped };
}

// ── Rule 2: Fisher-Yates + keccak256 with a win cap per wallet ────────────────
// Same steps as the original draw; a ticket whose wallet already has
// `maxWins` prizes is skipped and the shuffle simply continues.
// If no wallet hits the cap, the result equals the original algorithm.
// MUST stay identical to pickWinners() in index.html.
function pickWinners(blockHash, pool, num, maxWins) {
  const arr = [...pool];
  const n   = arr.length;
  const wins = {}, winners = [];
  for (let i = 0; i < n && winners.length < num; i++) {
    const encoded = ethers.solidityPacked(['bytes32', 'uint256'], [blockHash, i]);
    const rand    = BigInt(ethers.keccak256(encoded));
    const j       = Number(rand % BigInt(n - i)) + i;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const w = arr[i].wallet.toLowerCase();
    if ((wins[w] || 0) >= maxWins) continue;
    wins[w] = (wins[w] || 0) + 1;
    winners.push(arr[i]);
  }
  return winners;
}

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

  const maxTicketsRaw = (await ask("  Max tickets/wallet : [50] ")).trim() || "50";
  const maxTickets = parseInt(maxTicketsRaw);
  if (isNaN(maxTickets) || maxTickets < 1) {
    console.error("\n❌ Invalid max tickets per wallet.");
    rl.close(); process.exit(1);
  }

  const maxWinsRaw = (await ask("  Max wins/wallet    : [3] ")).trim() || "3";
  const maxWins = parseInt(maxWinsRaw);
  if (isNaN(maxWins) || maxWins < 1) {
    console.error("\n❌ Invalid max wins per wallet.");
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
  // ── 3. Rule 1: ticket cap per wallet (same as website) ───────
  const { tickets, capped } = applyTicketCap(entries, maxTickets);

  console.log(`🌳 Total NFTs    : ${entries.length} NFT IDs`);
  console.log(`🎟  Tickets       : ${tickets.length} (max ${maxTickets} per wallet)`);
  if (capped.length) {
    console.log(`   Capped wallets (${capped.length}):`);
    capped.forEach(c => console.log(`     ${c.wallet}  ${c.held} → ${maxTickets}`));
  }
  console.log(`⛓  Block number  : ${blockNumber}`);
  console.log(`🔑 Block hash    : ${blockHash.slice(0, 20)}...`);
  console.log(`🏆 Winners       : ${numWinners} (max ${maxWins} per wallet)`);
  console.log();

  if (tickets.length < numWinners) {
    console.error(`❌ Not enough tickets (${tickets.length}) for ${numWinners} winners.`);
    process.exit(1);
  }

  // ── 4. Rule 2: Fisher-Yates + keccak256 with win cap ─────────
  const winners = pickWinners(blockHash, tickets, numWinners, maxWins);

  // ── 5. Print results ──────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("  RESULTS");
  console.log("=".repeat(60));
  winners.forEach((w, i) => {
    console.log(`${String(i + 1).padStart(2)}. NFT #${w.nftId.padEnd(8)} → ${w.wallet}`);
  });
  console.log("=".repeat(60));
  if (winners.length < numWinners) {
    console.log(`⚠  Only ${winners.length} of ${numWinners} prizes could be awarded:`);
    console.log(`   not enough wallets under the ${maxWins}-win cap.`);
  }
  console.log();
  console.log("✅ Verification complete.");
  console.log("   If these match the announced results → draw was fair.");
  console.log();
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
