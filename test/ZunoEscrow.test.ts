import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("ZunoEscrow", function () {
  let escrow: any;
  let gigs: any;
  let cUSD: any;
  let ethers: any;
  let owner: any;
  let client: any;
  let freelancer: any;
  let treasury: any;

  const GIG_PRICE = parseEther("10");
  const FEE_BPS = 250; // 2.5%

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
      FEE_BPS,
    );
    await escrow.waitForDeployment();

    // Create a gig as freelancer
    await gigs
      .connect(freelancer)
      .createGig("Build a DApp", "desc", "dev", [], GIG_PRICE, 7, "");

    // Mint cUSD to client and approve escrow
    await cUSD.mint(client.address, parseEther("100"));
    await cUSD
      .connect(client)
      .approve(await escrow.getAddress(), parseEther("100"));
  });

  describe("placeOrder", function () {
    it("should place an order and lock cUSD", async function () {
      await escrow.connect(client).placeOrder(1);

      const order = await escrow.getOrder(1);
      expect(order.gigId).to.equal(1);
      expect(order.client).to.equal(client.address);
      expect(order.freelancer).to.equal(freelancer.address);
      expect(order.amount).to.equal(GIG_PRICE);
      expect(order.status).to.equal(1); // InProgress

      // cUSD should be locked in escrow
      const escrowBalance = await cUSD.balanceOf(await escrow.getAddress());
      expect(escrowBalance).to.equal(GIG_PRICE);
    });

    it("should revert if freelancer tries to order own gig", async function () {
      await cUSD.mint(freelancer.address, parseEther("100"));
      await cUSD
        .connect(freelancer)
        .approve(await escrow.getAddress(), parseEther("100"));
      await expect(
        escrow.connect(freelancer).placeOrder(1),
      ).to.be.revertedWithCustomError(escrow, "CannotOrderOwnGig");
    });

    it("should revert for inactive gig", async function () {
      await gigs.connect(freelancer).deleteGig(1);
      await expect(
        escrow.connect(client).placeOrder(1),
      ).to.be.revertedWithCustomError(escrow, "GigNotActive");
    });
  });

  describe("markDelivered", function () {
    beforeEach(async function () {
      await escrow.connect(client).placeOrder(1);
    });

    it("should mark order as delivered", async function () {
      await escrow.connect(freelancer).markDelivered(1);
      const order = await escrow.getOrder(1);
      expect(order.status).to.equal(2); // Delivered
    });

    it("should revert if not freelancer", async function () {
      await expect(
        escrow.connect(client).markDelivered(1),
      ).to.be.revertedWithCustomError(escrow, "NotOrderFreelancer");
    });
  });

  describe("approveDelivery", function () {
    beforeEach(async function () {
      await escrow.connect(client).placeOrder(1);
      await escrow.connect(freelancer).markDelivered(1);
    });

    it("should release funds to freelancer minus fee", async function () {
      const freelancerBefore = await cUSD.balanceOf(freelancer.address);
      const treasuryBefore = await cUSD.balanceOf(treasury.address);

      await escrow.connect(client).approveDelivery(1);

      const expectedFee = (GIG_PRICE * BigInt(FEE_BPS)) / 10000n;
      const expectedPayout = GIG_PRICE - expectedFee;

      expect(await cUSD.balanceOf(freelancer.address)).to.equal(
        freelancerBefore + expectedPayout,
      );
      expect(await cUSD.balanceOf(treasury.address)).to.equal(
        treasuryBefore + expectedFee,
      );
    });

    it("should revert if not client", async function () {
      await expect(
        escrow.connect(freelancer).approveDelivery(1),
      ).to.be.revertedWithCustomError(escrow, "NotOrderClient");
    });
  });

  describe("cancelOrder", function () {
    beforeEach(async function () {
      await escrow.connect(client).placeOrder(1);
    });

    it("should refund client on cancel", async function () {
      const clientBefore = await cUSD.balanceOf(client.address);
      await escrow.connect(client).cancelOrder(1);
      expect(await cUSD.balanceOf(client.address)).to.equal(
        clientBefore + GIG_PRICE,
      );

      const order = await escrow.getOrder(1);
      expect(order.status).to.equal(5); // Cancelled
    });

    it("should revert cancel after delivery", async function () {
      await escrow.connect(freelancer).markDelivered(1);
      await expect(
        escrow.connect(client).cancelOrder(1),
      ).to.be.revertedWithCustomError(escrow, "InvalidOrderStatus");
    });
  });

  describe("raiseDispute", function () {
    beforeEach(async function () {
      await escrow.connect(client).placeOrder(1);
      await escrow.connect(freelancer).markDelivered(1);
    });

    it("should raise dispute on delivered order", async function () {
      await escrow.connect(client).raiseDispute(1);
      const order = await escrow.getOrder(1);
      expect(order.status).to.equal(4); // Disputed
    });

    it("should revert dispute on non-delivered order", async function () {
      await escrow.connect(client).placeOrder(1); // place another order (id=2)
      // order 2 is InProgress, not Delivered
      await expect(
        escrow.connect(client).raiseDispute(2),
      ).to.be.revertedWithCustomError(escrow, "InvalidOrderStatus");
    });
  });

  describe("resolveDispute", function () {
    beforeEach(async function () {
      await escrow.connect(client).placeOrder(1);
      await escrow.connect(freelancer).markDelivered(1);
      await escrow.connect(client).raiseDispute(1);
    });

    it("should resolve with full refund to client", async function () {
      const clientBefore = await cUSD.balanceOf(client.address);
      await escrow.connect(owner).resolveDispute(1, 10000); // 100% to client
      expect(await cUSD.balanceOf(client.address)).to.equal(
        clientBefore + GIG_PRICE,
      );
    });

    it("should resolve with full payout to freelancer", async function () {
      const freelancerBefore = await cUSD.balanceOf(freelancer.address);
      await escrow.connect(owner).resolveDispute(1, 0); // 0% to client
      const expectedFee = (GIG_PRICE * BigInt(FEE_BPS)) / 10000n;
      expect(await cUSD.balanceOf(freelancer.address)).to.equal(
        freelancerBefore + GIG_PRICE - expectedFee,
      );
    });

    it("should revert if not owner", async function () {
      await expect(
        escrow.connect(client).resolveDispute(1, 5000),
      ).to.be.revertedWithCustomError(escrow, "NotAuthorized");
    });
  });
});
