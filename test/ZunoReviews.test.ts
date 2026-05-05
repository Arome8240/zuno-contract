import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("ZunoReviews", function () {
  let reviews: any;
  let escrow: any;
  let gigs: any;
  let cUSD: any;
  let ethers: any;
  let owner: any;
  let client: any;
  let freelancer: any;
  let treasury: any;

  const GIG_PRICE = parseEther("10");

  beforeEach(async function () {
    ({ ethers } = await network.create());
    [owner, client, freelancer, treasury] = await ethers.getSigners();

    // Deploy mock cUSD
    const MockCUSD = await ethers.getContractFactory("MockCUSD");
    cUSD = await MockCUSD.deploy();
    await cUSD.waitForDeployment();

    // Deploy ZunoGigs
    const ZunoGigs = await ethers.getContractFactory("ZunoGigs");
    gigs = await ZunoGigs.deploy();
    await gigs.waitForDeployment();

    // Deploy ZunoEscrow
    const ZunoEscrow = await ethers.getContractFactory("ZunoEscrow");
    escrow = await ZunoEscrow.deploy(
      await cUSD.getAddress(),
      await gigs.getAddress(),
      treasury.address,
      250,
    );
    await escrow.waitForDeployment();

    // Deploy ZunoReviews
    const ZunoReviews = await ethers.getContractFactory("ZunoReviews");
    reviews = await ZunoReviews.deploy(await escrow.getAddress());
    await reviews.waitForDeployment();

    // Create gig and complete an order
    await gigs
      .connect(freelancer)
      .createGig("Gig", "", "", [], GIG_PRICE, 7, "");
    await cUSD.mint(client.address, parseEther("100"));
    await cUSD
      .connect(client)
      .approve(await escrow.getAddress(), parseEther("100"));
    await escrow.connect(client).placeOrder(1);
    await escrow.connect(freelancer).markDelivered(1);
    await escrow.connect(client).approveDelivery(1);
  });

  describe("submitReview", function () {
    it("should allow client to review freelancer", async function () {
      await reviews.connect(client).submitReview(1, 5, "Great work!");
      const review = await reviews.getReview(1, client.address);
      expect(review.rating).to.equal(5);
      expect(review.reviewee).to.equal(freelancer.address);
    });

    it("should allow freelancer to review client", async function () {
      await reviews.connect(freelancer).submitReview(1, 4, "Good client");
      const review = await reviews.getReview(1, freelancer.address);
      expect(review.rating).to.equal(4);
      expect(review.reviewee).to.equal(client.address);
    });

    it("should revert if rating is invalid", async function () {
      await expect(
        reviews.connect(client).submitReview(1, 0, ""),
      ).to.be.revertedWithCustomError(reviews, "InvalidRating");
      await expect(
        reviews.connect(client).submitReview(1, 6, ""),
      ).to.be.revertedWithCustomError(reviews, "InvalidRating");
    });

    it("should revert if already reviewed", async function () {
      await reviews.connect(client).submitReview(1, 5, "");
      await expect(
        reviews.connect(client).submitReview(1, 4, ""),
      ).to.be.revertedWithCustomError(reviews, "AlreadyReviewed");
    });

    it("should revert if order not completed", async function () {
      // Place another order but don't complete it
      await escrow.connect(client).placeOrder(1);
      await expect(
        reviews.connect(client).submitReview(2, 5, ""),
      ).to.be.revertedWithCustomError(reviews, "OrderNotCompleted");
    });

    it("should revert if not order participant", async function () {
      await expect(
        reviews.connect(owner).submitReview(1, 5, ""),
      ).to.be.revertedWithCustomError(reviews, "NotOrderParticipant");
    });
  });

  describe("reputation", function () {
    it("should calculate average rating correctly", async function () {
      // Client reviews freelancer: 5
      await reviews.connect(client).submitReview(1, 5, "");
      expect(await reviews.getAverageRating(freelancer.address)).to.equal(500); // 5.00

      // Create and complete another order, client reviews 3
      await escrow.connect(client).placeOrder(1);
      await escrow.connect(freelancer).markDelivered(2);
      await escrow.connect(client).approveDelivery(2);
      await reviews.connect(client).submitReview(2, 3, "");

      // Average: (5 + 3) / 2 = 4.00
      expect(await reviews.getAverageRating(freelancer.address)).to.equal(400);
    });

    it("should return 0 for users with no reviews", async function () {
      expect(await reviews.getAverageRating(owner.address)).to.equal(0);
    });
  });

  describe("hasReviewed", function () {
    it("should return true after review", async function () {
      await reviews.connect(client).submitReview(1, 5, "");
      expect(await reviews.hasReviewed(1, client.address)).to.be.true;
    });

    it("should return false before review", async function () {
      expect(await reviews.hasReviewed(1, client.address)).to.be.false;
    });
  });
});
