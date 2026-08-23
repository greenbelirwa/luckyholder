# Lucky Holder Draw — Green Beli

Public, provably-fair lucky draw tool for Green Beli NFT Tree holders. Hosted as a
static site at `luckyholder.greenbeli.io` (see `CNAME`).

## Files

- **`index.html`** — the public draw page. Admin loads the participant CSV
  (published Google Sheet), enters a BSC block hash as the random seed, and
  runs the draw in-browser. Anyone can reproduce the exact same result with
  the same inputs (see "How the draw works" below).
- **`active-user-scanner.html`** — internal admin tool. Scans on-chain data
  via the [Moralis API](https://moralis.io) to build the participant list:
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

Because the pool is indexed by **NFT ID, not by unique wallet**, a wallet
holding multiple NFT Trees has multiple entries in the pool and therefore a
proportionally higher chance of being drawn — including winning more than
once in the same draw. This is intentional: each NFT has an equal,
independent chance of being selected regardless of which wallet holds it.

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
   announced block hash, block number, and number of winners.
4. Compare the output to the officially announced winners.
