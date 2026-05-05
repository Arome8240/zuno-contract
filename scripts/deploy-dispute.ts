import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS!;

  console.log("Deploying ZunoDispute...");
  const ZunoDispute = await ethers.getContractFactory("ZunoDispute");
  const dispute = await ZunoDispute.deploy(ESCROW_ADDRESS);
  await dispute.waitForDeployment();

  console.log("ZunoDispute deployed to:", await dispute.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
