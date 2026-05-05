import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  console.log("Deploying ZunoGigs...");

  const ZunoGigs = await ethers.getContractFactory("ZunoGigs");
  const gigs = await ZunoGigs.deploy();
  await gigs.waitForDeployment();

  console.log("ZunoGigs deployed to:", await gigs.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
