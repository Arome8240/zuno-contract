import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();

  // Replace with actual deployed addresses
  const CUSD_ADDRESS = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"; // Alfajores
  const GIGS_ADDRESS = process.env.GIGS_ADDRESS!;
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS!;
  const FEE_BPS = 250; // 2.5%

  console.log("Deploying ZunoEscrow...");
  const ZunoEscrow = await ethers.getContractFactory("ZunoEscrow");
  const escrow = await ZunoEscrow.deploy(
    CUSD_ADDRESS,
    GIGS_ADDRESS,
    TREASURY_ADDRESS,
    FEE_BPS,
  );
  await escrow.waitForDeployment();

  console.log("ZunoEscrow deployed to:", await escrow.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
