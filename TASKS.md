# Zuno Smart Contracts — Task Breakdown

## Today's Goal

Write and deploy all Zuno smart contracts on Celo (Alfajores testnet).

Each subtask must be committed before moving to the next.

---

## Subtasks

### ST-1: Project Setup

- [ ] Initialize Hardhat project in `zuno-contract/`
- [ ] Install dependencies: hardhat, ethers, OpenZeppelin, hardhat-deploy, dotenv
- [ ] Configure `hardhat.config.ts` for Celo Alfajores and Mainnet
- [ ] Set up `.env` with RPC URLs and deployer private key
- [ ] Add `.gitignore` (exclude `.env`, `artifacts/`, `cache/`)
- **Commit:** `chore: initialize hardhat project with celo config`

---

### ST-2: ZunoProfile Contract

- [ ] Write `ZunoProfile.sol`
  - Register/update profile (name, bio, avatar IPFS hash, skills)
  - Map wallet address → profile struct
  - Emit events on create/update
- [ ] Write deploy script for `ZunoProfile`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoProfile contract`

---

### ST-3: ZunoGigs Contract

- [ ] Write `ZunoGigs.sol`
  - Create, update, delete gigs
  - Gig struct: title, description, category, tags, price (cUSD), delivery days, IPFS metadata, owner, active flag
  - Only gig owner can edit/delete
  - Emit events on create/update/delete
- [ ] Write deploy script for `ZunoGigs`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoGigs contract`

---

### ST-4: ZunoEscrow Contract

- [ ] Write `ZunoEscrow.sol`
  - Place order: client sends cUSD, funds locked in escrow
  - Freelancer marks as delivered
  - Client approves → releases funds to freelancer (minus platform fee)
  - Client or freelancer can cancel (before delivery, full refund)
  - Order state machine: Pending → InProgress → Delivered → Completed / Disputed / Cancelled
  - Platform fee sent to ZunoTreasury address
  - Reference ZunoGigs to validate gig exists and get price
- [ ] Write deploy script for `ZunoEscrow`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoEscrow contract with cUSD escrow logic`

---

### ST-5: ZunoReviews Contract

- [ ] Write `ZunoReviews.sol`
  - Submit review after order completion (rating 1–5, comment)
  - Both client and freelancer can review each other per order
  - One review per party per order (immutable once submitted)
  - Aggregate reputation score per wallet
  - Only callable for orders in Completed state (validate via ZunoEscrow)
  - Emit events on review submission
- [ ] Write deploy script for `ZunoReviews`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoReviews contract`

---

### ST-6: ZunoDispute Contract

- [ ] Write `ZunoDispute.sol`
  - Raise dispute on a Delivered order
  - Arbitrator role (initially an admin/multisig, upgradeable to DAO)
  - Arbitrator resolves: full/partial refund to client or release to freelancer
  - Updates order state in ZunoEscrow on resolution
  - Emit events on dispute raised and resolved
- [ ] Write deploy script for `ZunoDispute`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoDispute contract`

---

### ST-7: ZunoTreasury Contract

- [ ] Write `ZunoTreasury.sol`
  - Receives platform fees from ZunoEscrow
  - Owner can withdraw accumulated cUSD fees
  - Track total fees collected
  - Emit events on fee receipt and withdrawal
- [ ] Write deploy script for `ZunoTreasury`
- [ ] Write basic tests
- **Commit:** `feat: add ZunoTreasury contract`

---

### ST-8: Integration & Deployment

- [ ] Wire all contracts together in deploy scripts (pass addresses as constructor args)
- [ ] Deploy full suite to Alfajores testnet
- [ ] Verify contracts on Celo explorer (Celoscan)
- [ ] Save deployed addresses to `deployments/alfajores.json`
- **Commit:** `chore: deploy all contracts to alfajores testnet`

---

## Contract Dependency Map

```
ZunoTreasury  ← ZunoEscrow (sends fees)
ZunoGigs      ← ZunoEscrow (validates gig)
ZunoEscrow    ← ZunoReviews (validates completed order)
ZunoEscrow    ← ZunoDispute (updates order state)
ZunoProfile   (standalone)
```

---

## Notes

- Use OpenZeppelin's `Ownable` and `ReentrancyGuard` on all contracts
- Use proxy pattern (UUPS or Transparent) for upgradeability
- cUSD on Celo Alfajores: `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1`
- cUSD on Celo Mainnet: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
