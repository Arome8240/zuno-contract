import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  const CUSD_ADDRESS = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"; // Alfajores

  console.log("Deploying ZunoTreasury...");
  const ZunoTreasury = await ethers.getContractFactory("ZunoTreasury");
  const treasury = await ZunoTreasury.deploy(CUSD_ADDRESS);
  await treasury.waitForDeployment();

  console.log("ZunoTreasury deployed to:", await treasury.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
