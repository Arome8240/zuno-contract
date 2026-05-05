import hre from "hardhat";

async function main() {
  console.log("Deploying ZunoProfile...");

  const { provider } = await hre.network.create();
  const [deployer] = await provider.getSigner();
  const deployerAddress = await deployer.getAddress();

  console.log("Deploying with account:", deployerAddress);

  const ZunoProfile = await hre.ethers.getContractFactory("ZunoProfile");
  const profile = await ZunoProfile.deploy();
  await profile.waitForDeployment();

  const address = await profile.getAddress();
  console.log("ZunoProfile deployed to:", address);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
