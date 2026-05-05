import { expect } from "chai";
import { network } from "hardhat";

describe("ZunoProfile", function () {
  let profile: any;
  let ethers: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    ({ ethers } = await network.create());
    [owner, user1, user2] = await ethers.getSigners();
    const ZunoProfileFactory = await ethers.getContractFactory("ZunoProfile");
    profile = await ZunoProfileFactory.deploy();
    await profile.waitForDeployment();
  });

  describe("createProfile", function () {
    it("should create a profile successfully", async function () {
      await profile
        .connect(user1)
        .createProfile(
          "Alice",
          "Solidity developer",
          "QmAvatarHash",
          ["Solidity", "React"],
          true,
          false,
        );

      const p = await profile.getProfile(user1.address);
      expect(p.displayName).to.equal("Alice");
      expect(p.bio).to.equal("Solidity developer");
      expect(p.isFreelancer).to.be.true;
      expect(p.isClient).to.be.false;
      expect(p.exists).to.be.true;
    });

    it("should revert if profile already exists", async function () {
      await profile
        .connect(user1)
        .createProfile("Alice", "", "", [], true, false);
      await expect(
        profile.connect(user1).createProfile("Alice2", "", "", [], true, false),
      ).to.be.revertedWithCustomError(profile, "ProfileAlreadyExists");
    });

    it("should revert with empty display name", async function () {
      await expect(
        profile.connect(user1).createProfile("", "", "", [], true, false),
      ).to.be.revertedWithCustomError(profile, "InvalidDisplayName");
    });

    it("should revert if no role selected", async function () {
      await expect(
        profile.connect(user1).createProfile("Alice", "", "", [], false, false),
      ).to.be.revertedWithCustomError(profile, "MustHaveAtLeastOneRole");
    });
  });

  describe("updateProfile", function () {
    beforeEach(async function () {
      await profile
        .connect(user1)
        .createProfile("Alice", "Bio", "", ["Solidity"], true, false);
    });

    it("should update profile successfully", async function () {
      await profile
        .connect(user1)
        .updateProfile("Alice Updated", "New bio", "", ["React"], true, true);
      const p = await profile.getProfile(user1.address);
      expect(p.displayName).to.equal("Alice Updated");
      expect(p.isClient).to.be.true;
    });

    it("should revert if profile does not exist", async function () {
      await expect(
        profile.connect(user2).updateProfile("Bob", "", "", [], true, false),
      ).to.be.revertedWithCustomError(profile, "ProfileNotFound");
    });
  });

  describe("view functions", function () {
    it("hasProfile returns false for unregistered user", async function () {
      expect(await profile.hasProfile(user1.address)).to.be.false;
    });

    it("isFreelancer and isClient return correct values", async function () {
      await profile
        .connect(user1)
        .createProfile("Alice", "", "", [], true, true);
      expect(await profile.isFreelancer(user1.address)).to.be.true;
      expect(await profile.isClient(user1.address)).to.be.true;
    });

    it("totalProfiles increments on creation", async function () {
      expect(await profile.totalProfiles()).to.equal(0);
      await profile
        .connect(user1)
        .createProfile("Alice", "", "", [], true, false);
      expect(await profile.totalProfiles()).to.equal(1);
    });
  });
});
