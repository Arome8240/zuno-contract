import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS!;

  console.log("Deploying ZunoReviews...");
  const ZunoReviews = await ethers.getContractFactory("ZunoReviews");
  const reviews = await ZunoReviews.deploy(ESCROW_ADDRESS);
  await reviews.waitForDeployment();

  console.log("ZunoReviews deployed to:", await reviews.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
