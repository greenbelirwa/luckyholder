# Lucky Holder Draw — Green Beli

Public, provably-fair lucky draw tool for Green Beli NFT Tree holders. Hosted as a
static site at `luckyholder.greenbeli.io` (see `CNAME`).

## Files

- **`index.html`** — the public draw page. Admin loads the participant CSV
  (published Google Sheet), enters a BSC block hash as the random seed, and
  runs the draw in-browser. Anyone can reproduce the exact same result with
  the same inputs (see "How the draw works" below).
- **`active-user-scanner.html`** — internal admin tool. Scans on-chain data
  via the [Ankr Advanced API](https://www.ankr.com/advanced-api/) (GRBE transfer history) and public BSC RPC + Multicall3 (NFT Tree holdings) to build the participant list:
  wallets that sent ≥ 1 GRBE to the admin wallet, cross-referenced with which
  of those wallets hold an NFT Tree. Exports a CSV (`No,NFT_ID,WALLET`) ready
  to paste into the participant Google Sheet, plus a SHA-256 hash of that CSV
  to publish for integrity verification.
- **`verify-draw.js`** + **`package.json`** — standalone Node.js script so
  anyone can independently re-run the exact same draw algorithm offline and
  confirm the announced winners. Run `npm install` then `node verify-draw.js`.

## How the draw works

Each row of the participant CSV is one entry (one NFT ID + its owning
wallet). The draw is a **Fisher–Yates shuffle** seeded with `keccak256(block
hash, index)`, so it is fully deterministic: the same block hash + same CSV
always produces the same winners, and anyone can verify it with
`verify-draw.js` or by reading the algorithm shown on the draw page.

Each NFT Tree is one ticket, so a wallet holding more Trees has a higher
chance of being drawn. Two per-wallet limits keep the draw open to more
holders:

1. **Max tickets per wallet (default 50).** Only the first 50 NFTs of each
   wallet, in CSV order, become tickets; the rest are left out of the pool.
   Wallets are compared case-insensitively.
2. **Max wins per wallet (default 3).** The shuffle runs exactly as before
   (same seed, same index `i`). When the ticket at position `i` belongs to a
   wallet that already has 3 prizes, it is skipped and the shuffle simply
   continues with `i + 1` until all prizes are awarded or the pool runs out.

If no wallet reaches either limit, the result is identical to the original
algorithm. Both limits are shown on the draw page and asked for by
`verify-draw.js`, so the announcement must state the values used.

For fairness, the block hash should be chosen **after** publishing the
participant list and its SHA-256 hash, and ideally the block number should be
announced before that block is mined, so the outcome can't be cherry-picked
after the fact.

## Verifying a draw yourself

1. Download the published CSV from the Google Sheet link.
2. Format the `NFT_ID` and `WALLET` columns as **Plain Text** if re-entering
   data into a spreadsheet, to avoid Google Sheets silently reformatting
   numbers.
3. Run `npm install && node verify-draw.js` in this folder and enter the
   announced block hash, block number, number of winners, max tickets per
   wallet and max wins per wallet (press Enter for the defaults 50 and 3).
4. Compare the output to the officially announced winners.
