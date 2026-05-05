import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("ZunoGigs", function () {
  let gigs: any;
  let ethers: any;
  let owner: any;
  let freelancer: any;
  let other: any;

  const GIG_PRICE = parseEther("10"); // 10 cUSD

  beforeEach(async function () {
    ({ ethers } = await network.create());
    [owner, freelancer, other] = await ethers.getSigners();
    const ZunoGigsFactory = await ethers.getContractFactory("ZunoGigs");
    gigs = await ZunoGigsFactory.deploy();
    await gigs.waitForDeployment();
  });

  describe("createGig", function () {
    it("should create a gig and return id 1", async function () {
      const tx = await gigs
        .connect(freelancer)
        .createGig(
          "Build a DApp",
          "I will build your dapp",
          "Development",
          ["Solidity", "React"],
          GIG_PRICE,
          7,
          "QmMetaHash",
        );
      await tx.wait();

      const gig = await gigs.getGig(1);
      expect(gig.id).to.equal(1);
      expect(gig.title).to.equal("Build a DApp");
      expect(gig.owner).to.equal(freelancer.address);
      expect(gig.price).to.equal(GIG_PRICE);
      expect(gig.active).to.be.true;
    });

    it("should revert with empty title", async function () {
      await expect(
        gigs
          .connect(freelancer)
          .createGig("", "desc", "cat", [], GIG_PRICE, 7, ""),
      ).to.be.revertedWithCustomError(gigs, "InvalidTitle");
    });

    it("should revert with zero price", async function () {
      await expect(
        gigs
          .connect(freelancer)
          .createGig("Title", "desc", "cat", [], 0, 7, ""),
      ).to.be.revertedWithCustomError(gigs, "InvalidPrice");
    });

    it("should revert with zero delivery days", async function () {
      await expect(
        gigs
          .connect(freelancer)
          .createGig("Title", "desc", "cat", [], GIG_PRICE, 0, ""),
      ).to.be.revertedWithCustomError(gigs, "InvalidDeliveryDays");
    });

    it("should increment gig ids", async function () {
      await gigs
        .connect(freelancer)
        .createGig("Gig 1", "", "", [], GIG_PRICE, 1, "");
      await gigs
        .connect(freelancer)
        .createGig("Gig 2", "", "", [], GIG_PRICE, 1, "");
      expect(await gigs.totalGigs()).to.equal(2);
    });
  });

  describe("updateGig", function () {
    beforeEach(async function () {
      await gigs
        .connect(freelancer)
        .createGig("Original", "desc", "cat", [], GIG_PRICE, 7, "");
    });

    it("should update gig successfully", async function () {
      const newPrice = parseEther("20");
      await gigs
        .connect(freelancer)
        .updateGig(1, "Updated", "new desc", "cat", [], newPrice, 3, "");
      const gig = await gigs.getGig(1);
      expect(gig.title).to.equal("Updated");
      expect(gig.price).to.equal(newPrice);
    });

    it("should revert if not owner", async function () {
      await expect(
        gigs.connect(other).updateGig(1, "Hack", "", "", [], GIG_PRICE, 1, ""),
      ).to.be.revertedWithCustomError(gigs, "NotGigOwner");
    });
  });

  describe("deleteGig", function () {
    beforeEach(async function () {
      await gigs
        .connect(freelancer)
        .createGig("To Delete", "", "", [], GIG_PRICE, 1, "");
    });

    it("should soft-delete a gig", async function () {
      await gigs.connect(freelancer).deleteGig(1);
      const gig = await gigs.getGig(1);
      expect(gig.active).to.be.false;
    });

    it("should revert if not owner", async function () {
      await expect(
        gigs.connect(other).deleteGig(1),
      ).to.be.revertedWithCustomError(gigs, "NotGigOwner");
    });

    it("should revert operations on deleted gig", async function () {
      await gigs.connect(freelancer).deleteGig(1);
      await expect(
        gigs
          .connect(freelancer)
          .updateGig(1, "Title", "", "", [], GIG_PRICE, 1, ""),
      ).to.be.revertedWithCustomError(gigs, "GigNotActive");
    });
  });

  describe("view functions", function () {
    it("getGigsByOwner returns correct ids", async function () {
      await gigs
        .connect(freelancer)
        .createGig("G1", "", "", [], GIG_PRICE, 1, "");
      await gigs
        .connect(freelancer)
        .createGig("G2", "", "", [], GIG_PRICE, 1, "");
      const ids = await gigs.getGigsByOwner(freelancer.address);
      expect(ids.length).to.equal(2);
    });

    it("isGigActive returns false for deleted gig", async function () {
      await gigs
        .connect(freelancer)
        .createGig("G1", "", "", [], GIG_PRICE, 1, "");
      await gigs.connect(freelancer).deleteGig(1);
      expect(await gigs.isGigActive(1)).to.be.false;
    });

    it("getGigPrice reverts on deleted gig", async function () {
      await gigs
        .connect(freelancer)
        .createGig("G1", "", "", [], GIG_PRICE, 1, "");
      await gigs.connect(freelancer).deleteGig(1);
      await expect(gigs.getGigPrice(1)).to.be.revertedWithCustomError(
        gigs,
        "GigNotActive",
      );
    });
  });
});
