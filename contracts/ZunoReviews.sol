// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IZunoEscrow {
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
}

/// @title ZunoReviews
/// @notice On-chain reviews and reputation for the Zuno marketplace
contract ZunoReviews is Ownable, ReentrancyGuard {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct Review {
        uint256 orderId;
        address reviewer;
        address reviewee;
        uint8 rating;       // 1–5
        string comment;
        uint256 createdAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IZunoEscrow public immutable escrowContract;

    // orderId => reviewer address => Review
    mapping(uint256 => mapping(address => Review)) private reviews;

    // wallet => total rating points, total review count
    mapping(address => uint256) public totalRatingPoints;
    mapping(address => uint256) public totalReviewCount;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ReviewSubmitted(
        uint256 indexed orderId,
        address indexed reviewer,
        address indexed reviewee,
        uint8 rating
    );

    // ─── Errors ──────────────────────────────────────────────────────────────

    error OrderNotCompleted();
    error NotOrderParticipant();
    error AlreadyReviewed();
    error InvalidRating();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _escrowContract) Ownable(msg.sender) {
        escrowContract = IZunoEscrow(_escrowContract);
    }

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Submit a review for a completed order
    /// @param orderId The completed order ID
    /// @param rating Rating from 1 to 5
    /// @param comment Optional text comment
    function submitReview(
        uint256 orderId,
        uint8 rating,
        string calldata comment
    ) external nonReentrant {
        if (rating < 1 || rating > 5) revert InvalidRating();

        IZunoEscrow.Order memory order = escrowContract.getOrder(orderId);

        // Only allow reviews on completed orders
        if (order.status != IZunoEscrow.OrderStatus.Completed) revert OrderNotCompleted();

        // Only client or freelancer can review
        bool isClient = order.client == msg.sender;
        bool isFreelancer = order.freelancer == msg.sender;
        if (!isClient && !isFreelancer) revert NotOrderParticipant();

        // One review per party per order
        if (reviews[orderId][msg.sender].createdAt != 0) revert AlreadyReviewed();

        // Reviewee is the other party
        address reviewee = isClient ? order.freelancer : order.client;

        reviews[orderId][msg.sender] = Review({
            orderId: orderId,
            reviewer: msg.sender,
            reviewee: reviewee,
            rating: rating,
            comment: comment,
            createdAt: block.timestamp
        });

        totalRatingPoints[reviewee] += rating;
        totalReviewCount[reviewee] += 1;

        emit ReviewSubmitted(orderId, msg.sender, reviewee, rating);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Get a specific review for an order by reviewer
    function getReview(uint256 orderId, address reviewer) external view returns (Review memory) {
        return reviews[orderId][reviewer];
    }

    /// @notice Get the average rating for a wallet (scaled by 100, e.g. 450 = 4.50)
    function getAverageRating(address user) external view returns (uint256) {
        if (totalReviewCount[user] == 0) return 0;
        return (totalRatingPoints[user] * 100) / totalReviewCount[user];
    }

    /// @notice Check if a reviewer has already reviewed an order
    function hasReviewed(uint256 orderId, address reviewer) external view returns (bool) {
        return reviews[orderId][reviewer].createdAt != 0;
    }
}
