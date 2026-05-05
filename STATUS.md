# Zuno Smart Contracts — Status

## Completed (Today)

All 7 subtasks completed and committed:

- ✅ **ST-1**: Project setup with Hardhat 3 + Celo config
- ✅ **ST-2**: ZunoProfile contract (9 tests passing)
- ✅ **ST-3**: ZunoGigs contract (13 tests passing)
- ✅ **ST-4**: ZunoEscrow contract with cUSD escrow logic (14 tests passing)
- ✅ **ST-5**: ZunoReviews contract (10 tests passing)
- ✅ **ST-6**: ZunoDispute contract (10 tests passing)
- ✅ **ST-7**: ZunoTreasury contract (8 tests passing)

**Total: 64 tests passing**

## Next Steps (ST-8)

Deploy all contracts to Alfajores testnet:

1. Add private key and Celoscan API key to `.env`
2. Deploy in order: Treasury → Gigs → Escrow → Reviews → Dispute → Profile
3. Wire contracts together (set treasury in escrow, transfer escrow ownership to dispute)
4. Verify on Celoscan
5. Save addresses to `deployments/alfajores.json`

## Contract Addresses (Alfajores)

_To be filled after deployment_

- ZunoProfile:
- ZunoGigs:
- ZunoEscrow:
- ZunoReviews:
- ZunoDispute:
- ZunoTreasury:
- cUSD (existing): `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1`
