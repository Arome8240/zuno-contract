// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IZunoEscrowDispute {
    enum OrderStatus {
        Pending,
        InProgress,
        Delivered,
        Completed,
        Disputed,
        Cancelled
    }

    struct Order {
        uint256 id;
        uint256 gigId;
        address client;
        address freelancer;
        uint256 amount;
        uint256 platformFee;
        OrderStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    function getOrder(uint256 orderId) external view returns (Order memory);
    function resolveDispute(uint256 orderId, uint256 clientRefundBps) external;
}

/// @title ZunoDispute
/// @notice Manages dispute creation and arbitration for the Zuno marketplace
contract ZunoDispute is Ownable, ReentrancyGuard {
    // ─── Enums ───────────────────────────────────────────────────────────────

    enum DisputeStatus {
        Open,
        Resolved
    }

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Dispute {
        uint256 id;
        uint256 orderId;
        address raisedBy;
        string reason;
        DisputeStatus status;
        address resolvedBy;
        uint256 clientRefundBps; // 0–10000
        uint256 createdAt;
        uint256 resolvedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IZunoEscrowDispute public immutable escrowContract;

    uint256 private nextDisputeId = 1;
    mapping(uint256 => Dispute) private disputes;

    // orderId => disputeId (one active dispute per order)
    mapping(uint256 => uint256) public disputeByOrder;

    // Authorized arbitrators (owner can add/remove)
    mapping(address => bool) public isArbitrator;

    // ─── Events ──────────────────────────────────────────────────────────────

    event DisputeRaised(uint256 indexed disputeId, uint256 indexed orderId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed orderId, address resolvedBy, uint256 clientRefundBps);
    event ArbitratorAdded(address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error OrderNotDisputed();
    error NotOrderParticipant();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error NotArbitrator();
    error InvalidRefundBps();
    error DisputeAlreadyExists();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _escrowContract) Ownable(msg.sender) {
        escrowContract = IZunoEscrowDispute(_escrowContract);
        // Owner is the initial arbitrator
        isArbitrator[msg.sender] = true;
    }

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Raise a dispute for a disputed order (must be in Disputed state in escrow)
    /// @param orderId The order ID in disputed state
    /// @param reason Text reason for the dispute
    function raiseDispute(uint256 orderId, string calldata reason) external nonReentrant returns (uint256 disputeId) {
        IZunoEscrowDispute.Order memory order = escrowContract.getOrder(orderId);

        if (order.status != IZunoEscrowDispute.OrderStatus.Disputed) revert OrderNotDisputed();
        if (order.client != msg.sender && order.freelancer != msg.sender) revert NotOrderParticipant();
        if (disputeByOrder[orderId] != 0) revert DisputeAlreadyExists();

        disputeId = nextDisputeId++;

        disputes[disputeId] = Dispute({
            id: disputeId,
            orderId: orderId,
            raisedBy: msg.sender,
            reason: reason,
            status: DisputeStatus.Open,
            resolvedBy: address(0),
            clientRefundBps: 0,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        disputeByOrder[orderId] = disputeId;

        emit DisputeRaised(disputeId, orderId, msg.sender);
    }

    /// @notice Resolve a dispute — arbitrators only
    /// @param disputeId The dispute to resolve
    /// @param clientRefundBps Percentage (in bps) to refund to client (0 = all to freelancer, 10000 = all to client)
    function resolveDispute(uint256 disputeId, uint256 clientRefundBps) external nonReentrant {
        if (!isArbitrator[msg.sender]) revert NotArbitrator();
        if (clientRefundBps > 10_000) revert InvalidRefundBps();

        Dispute storage dispute = _getDispute(disputeId);
        if (dispute.status == DisputeStatus.Resolved) revert DisputeAlreadyResolved();

        dispute.status = DisputeStatus.Resolved;
        dispute.resolvedBy = msg.sender;
        dispute.clientRefundBps = clientRefundBps;
        dispute.resolvedAt = block.timestamp;

        // Trigger resolution in escrow
        escrowContract.resolveDispute(dispute.orderId, clientRefundBps);

        emit DisputeResolved(disputeId, dispute.orderId, msg.sender, clientRefundBps);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function addArbitrator(address arbitrator) external onlyOwner {
        isArbitrator[arbitrator] = true;
        emit ArbitratorAdded(arbitrator);
    }

    function removeArbitrator(address arbitrator) external onlyOwner {
        isArbitrator[arbitrator] = false;
        emit ArbitratorRemoved(arbitrator);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        if (disputes[disputeId].id == 0) revert DisputeNotFound();
        return disputes[disputeId];
    }

    function getDisputeByOrder(uint256 orderId) external view returns (Dispute memory) {
        uint256 disputeId = disputeByOrder[orderId];
        if (disputeId == 0) revert DisputeNotFound();
        return disputes[disputeId];
    }

    function totalDisputes() external view returns (uint256) {
        return nextDisputeId - 1;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getDispute(uint256 disputeId) internal view returns (Dispute storage) {
        if (disputes[disputeId].id == 0) revert DisputeNotFound();
        return disputes[disputeId];
    }
}
