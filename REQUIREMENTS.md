# Zuno — Requirements

## Overview

Zuno is a decentralized freelance marketplace built on Celo, designed specifically for MiniPay. It connects freelancers (sellers) with clients (buyers) in a trustless, on-chain environment. All core interactions — payments, escrow, reviews, and dispute resolution — happen on-chain using cUSD.

---

## Users

- **Freelancer (Seller)** — creates a profile, lists services (gigs), receives payments
- **Client (Buyer)** — browses gigs, places orders, releases payments after delivery

---

## Core Features

### 1. User Profiles

- Every user connects via their MiniPay wallet (no traditional sign-up)
- Profile stores: display name, bio, avatar (IPFS), wallet address, skills/tags
- Profiles are on-chain (or metadata stored on IPFS with on-chain reference)
- Separate role flags: can act as freelancer, client, or both

### 2. Gig Listings

- Freelancers can create, edit, and delete gigs
- Each gig includes: title, description, category, tags, price (in cUSD), delivery time, and media (IPFS)
- Gigs are stored on-chain (or IPFS with on-chain registry)
- Clients can browse and search gigs by category, tags, or keyword

### 3. Orders & Escrow

- Client places an order by sending cUSD into a smart contract escrow
- Escrow holds funds until the client approves delivery or a dispute is resolved
- Order states: `Pending` → `InProgress` → `Delivered` → `Completed` / `Disputed` / `Cancelled`
- Freelancer marks order as delivered on-chain
- Client can approve delivery (releases funds to freelancer) or raise a dispute

### 4. Dispute Resolution

- Either party can raise a dispute on an order
- A decentralized arbitration mechanism resolves disputes (e.g. a small panel of staked arbitrators or a DAO vote)
- Arbitrators are incentivized with a small fee from the disputed order
- Resolution outcome: full/partial refund to client, or full/partial release to freelancer

### 5. Reviews & Reputation

- After order completion, both parties can leave a review (rating 1–5 + comment)
- Reviews are stored on-chain and tied to wallet addresses
- Reputation score is derived from on-chain reviews and visible on profiles
- Reviews are immutable once submitted

### 6. Payments

- All payments in cUSD (Celo Dollar)
- Platform takes a small fee (e.g. 2–3%) on each completed order
- Fees accumulate in a treasury contract
- No off-chain payment processing

### 7. Notifications (MiniPay-aware)

- In-app notifications for order updates, messages, and disputes
- Optimized for MiniPay's browser environment

---

## MiniPay Integration

- App is a Progressive Web App (PWA) optimized for MiniPay's in-app browser
- Detects MiniPay wallet via `window.ethereum` provider checks
- Uses MiniPay hooks for wallet connection and transaction signing
- UI is mobile-first, lightweight, and fast-loading
- No WalletConnect or external wallet modals — MiniPay is the primary wallet

---

## Smart Contracts

| Contract       | Responsibility                   |
| -------------- | -------------------------------- |
| `ZunoProfile`  | On-chain user profile registry   |
| `ZunoGigs`     | Gig creation and management      |
| `ZunoEscrow`   | Order lifecycle and cUSD escrow  |
| `ZunoReviews`  | On-chain reviews and reputation  |
| `ZunoDispute`  | Dispute creation and arbitration |
| `ZunoTreasury` | Platform fee collection          |

---

## Tech Stack

- Frontend: Next.js (PWA), TailwindCSS
- Blockchain: Celo (Mainnet + Alfajores testnet)
- Smart Contracts: Solidity, Hardhat
- Storage: IPFS (via web3.storage or Pinata) for media and metadata
- Wallet: MiniPay (via `window.ethereum`)
- Contract interaction: viem / wagmi

---

## Non-Functional Requirements

- Mobile-first, responsive UI optimized for MiniPay's browser
- All on-chain transactions should give clear feedback (pending, success, failed)
- Gas costs should be minimized (Celo is low-fee but still worth optimizing)
- Contracts must be auditable and upgradeable (proxy pattern)
- App must work offline-gracefully (PWA caching for static assets)

---

## Out of Scope (v1)

- Native mobile app
- Multi-token payments (only cUSD in v1)
- Video calls or real-time chat
- AI-powered gig recommendations
