import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("ZunoTreasury", function () {
  let treasury: any;
  let cUSD: any;
  let ethers: any;
  let owner: any;
  let other: any;

  beforeEach(async function () {
    ({ ethers } = await network.create());
    [owner, other] = await ethers.getSigners();

    const MockCUSD = await ethers.getContractFactory("MockCUSD");
    cUSD = await MockCUSD.deploy();
    await cUSD.waitForDeployment();

    const ZunoTreasury = await ethers.getContractFactory("ZunoTreasury");
    treasury = await ZunoTreasury.deploy(await cUSD.getAddress());
    await treasury.waitForDeployment();

    // Fund the treasury directly
    await cUSD.mint(await treasury.getAddress(), parseEther("50"));
  });

  describe("balance", function () {
    it("should return correct balance", async function () {
      expect(await treasury.balance()).to.equal(parseEther("50"));
    });
  });

  describe("withdraw", function () {
    it("should withdraw specified amount to recipient", async function () {
      const otherBefore = await cUSD.balanceOf(other.address);
      await treasury.connect(owner).withdraw(other.address, parseEther("10"));
      expect(await cUSD.balanceOf(other.address)).to.equal(
        otherBefore + parseEther("10"),
      );
      expect(await treasury.balance()).to.equal(parseEther("40"));
    });

    it("should revert if amount exceeds balance", async function () {
      await expect(
        treasury.connect(owner).withdraw(other.address, parseEther("100")),
      ).to.be.revertedWithCustomError(treasury, "InsufficientBalance");
    });

    it("should revert with zero amount", async function () {
      await expect(
        treasury.connect(owner).withdraw(other.address, 0),
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });

    it("should revert with zero address recipient", async function () {
      await expect(
        treasury
          .connect(owner)
          .withdraw(
            "0x0000000000000000000000000000000000000000",
            parseEther("1"),
          ),
      ).to.be.revertedWithCustomError(treasury, "InvalidRecipient");
    });

    it("should revert if not owner", async function () {
      await expect(
        treasury.connect(other).withdraw(other.address, parseEther("1")),
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });
  });

  describe("withdrawAll", function () {
    it("should withdraw entire balance to owner", async function () {
      const ownerBefore = await cUSD.balanceOf(owner.address);
      await treasury.connect(owner).withdrawAll();
      expect(await cUSD.balanceOf(owner.address)).to.equal(
        ownerBefore + parseEther("50"),
      );
      expect(await treasury.balance()).to.equal(0);
    });

    it("should revert if balance is zero", async function () {
      await treasury.connect(owner).withdrawAll();
      await expect(
        treasury.connect(owner).withdrawAll(),
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });
  });
});
