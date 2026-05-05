import { expect } from "chai";
import { network } from "hardhat";
import { parseEther } from "ethers";

describe("ZunoDispute", function () {
  let dispute: any;
  let escrow: any;
  let gigs: any;
  let cUSD: any;
  let ethers: any;
  let owner: any;
  let client: any;
  let freelancer: any;
  let treasury: any;
  let arbitrator: any;

  const GIG_PRICE = parseEther("10");

  async function setupDisputedOrder() {
    await gigs
      .connect(freelancer)
      .createGig("Gig", "", "", [], GIG_PRICE, 7, "");
    await cUSD.mint(client.address, parseEther("100"));
    await cUSD
      .connect(client)
      .approve(await escrow.getAddress(), parseEther("100"));
    await escrow.connect(client).placeOrder(1);
    await escrow.connect(freelancer).markDelivered(1);
    await escrow.connect(client).raiseDispute(1);
  }

  beforeEach(async function () {
    ({ ethers } = await network.create());
    [owner, client, freelancer, treasury, arbitrator] =
      await ethers.getSigners();

    const MockCUSD = await ethers.getContractFactory("MockCUSD");
    cUSD = await MockCUSD.deploy();
    await cUSD.waitForDeployment();

    const ZunoGigs = await ethers.getContractFactory("ZunoGigs");
    gigs = await ZunoGigs.deploy();
    await gigs.waitForDeployment();

    const ZunoEscrow = await ethers.getContractFactory("ZunoEscrow");
    escrow = await ZunoEscrow.deploy(
      await cUSD.getAddress(),
      await gigs.getAddress(),
      treasury.address,
      250,
    );
    await escrow.waitForDeployment();

    const ZunoDispute = await ethers.getContractFactory("ZunoDispute");
    dispute = await ZunoDispute.deploy(await escrow.getAddress());
    await dispute.waitForDeployment();

    // Grant dispute contract permission to resolve in escrow
    // (transfer ownership of escrow to dispute contract for testing)
    await escrow.connect(owner).transferOwnership(await dispute.getAddress());
  });

  describe("raiseDispute", function () {
    beforeEach(async function () {
      await setupDisputedOrder();
    });

    it("should raise a dispute for a disputed order", async function () {
      await dispute
        .connect(client)
        .raiseDispute(1, "Work not delivered as described");
      const d = await dispute.getDisputeByOrder(1);
      expect(d.orderId).to.equal(1);
      expect(d.raisedBy).to.equal(client.address);
      expect(d.status).to.equal(0); // Open
    });

    it("should revert if order is not in disputed state", async function () {
      // Create a new order that's InProgress
      await gigs
        .connect(freelancer)
        .createGig("Gig2", "", "", [], GIG_PRICE, 7, "");
      await cUSD.mint(client.address, parseEther("100"));
      await cUSD
        .connect(client)
        .approve(await escrow.getAddress(), parseEther("100"));
      await escrow.connect(client).placeOrder(2);
      await expect(
        dispute.connect(client).raiseDispute(2, "reason"),
      ).to.be.revertedWithCustomError(dispute, "OrderNotDisputed");
    });

    it("should revert if not order participant", async function () {
      await expect(
        dispute.connect(arbitrator).raiseDispute(1, "reason"),
      ).to.be.revertedWithCustomError(dispute, "NotOrderParticipant");
    });

    it("should revert if dispute already exists for order", async function () {
      await dispute.connect(client).raiseDispute(1, "reason");
      await expect(
        dispute.connect(client).raiseDispute(1, "again"),
      ).to.be.revertedWithCustomError(dispute, "DisputeAlreadyExists");
    });
  });

  describe("resolveDispute", function () {
    beforeEach(async function () {
      await setupDisputedOrder();
      await dispute.connect(client).raiseDispute(1, "reason");
    });

    it("should resolve dispute with full refund to client", async function () {
      const clientBefore = await cUSD.balanceOf(client.address);
      await dispute.connect(owner).resolveDispute(1, 10000);
      expect(await cUSD.balanceOf(client.address)).to.equal(
        clientBefore + GIG_PRICE,
      );

      const d = await dispute.getDispute(1);
      expect(d.status).to.equal(1); // Resolved
      expect(d.clientRefundBps).to.equal(10000);
    });

    it("should resolve dispute with full payout to freelancer", async function () {
      const freelancerBefore = await cUSD.balanceOf(freelancer.address);
      await dispute.connect(owner).resolveDispute(1, 0);
      const fee = (GIG_PRICE * 250n) / 10000n;
      expect(await cUSD.balanceOf(freelancer.address)).to.equal(
        freelancerBefore + GIG_PRICE - fee,
      );
    });

    it("should revert if not arbitrator", async function () {
      await expect(
        dispute.connect(client).resolveDispute(1, 5000),
      ).to.be.revertedWithCustomError(dispute, "NotArbitrator");
    });

    it("should revert if already resolved", async function () {
      await dispute.connect(owner).resolveDispute(1, 5000);
      await expect(
        dispute.connect(owner).resolveDispute(1, 5000),
      ).to.be.revertedWithCustomError(dispute, "DisputeAlreadyResolved");
    });
  });

  describe("arbitrator management", function () {
    it("should add and remove arbitrators", async function () {
      await dispute.connect(owner).addArbitrator(arbitrator.address);
      expect(await dispute.isArbitrator(arbitrator.address)).to.be.true;

      await dispute.connect(owner).removeArbitrator(arbitrator.address);
      expect(await dispute.isArbitrator(arbitrator.address)).to.be.false;
    });

    it("should revert if non-owner tries to add arbitrator", async function () {
      await expect(
        dispute.connect(client).addArbitrator(arbitrator.address),
      ).to.be.revertedWithCustomError(dispute, "OwnableUnauthorizedAccount");
    });
  });
});
