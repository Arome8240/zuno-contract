// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IZunoGigs {
    function isGigActive(uint256 gigId) external view returns (bool);
    function getGigPrice(uint256 gigId) external view returns (uint256);
    function getGigOwner(uint256 gigId) external view returns (address);
}

/// @title ZunoEscrow
/// @notice Manages order lifecycle and cUSD escrow for the Zuno marketplace
contract ZunoEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Enums ───────────────────────────────────────────────────────────────

    enum OrderStatus {
        Pending,    // order placed, awaiting freelancer acceptance (reserved for future use)
        InProgress, // freelancer accepted / work started
        Delivered,  // freelancer marked as delivered
        Completed,  // client approved, funds released
        Disputed,   // dispute raised
        Cancelled   // cancelled before delivery
    }

    // ─── Structs ────────────────────────────────────────────────────────────

    struct Order {
        uint256 id;
        uint256 gigId;
        address client;
        address freelancer;
        uint256 amount;       // cUSD locked in escrow (18 decimals)
        uint256 platformFee;  // fee deducted on completion
        OrderStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable cUSD;
    IZunoGigs public immutable gigsContract;
    address public treasury;
    uint256 public platformFeeBps; // basis points, e.g. 250 = 2.5%

    uint256 private nextOrderId = 1;
    mapping(uint256 => Order) private orders;
    mapping(address => uint256[]) private ordersByClient;
    mapping(address => uint256[]) private ordersByFreelancer;

    // ─── Events ──────────────────────────────────────────────────────────────

    event OrderPlaced(uint256 indexed orderId, uint256 indexed gigId, address indexed client, address freelancer, uint256 amount);
    event OrderDelivered(uint256 indexed orderId);
    event OrderCompleted(uint256 indexed orderId, address indexed freelancer, uint256 payout);
    event OrderCancelled(uint256 indexed orderId, address indexed client, uint256 refund);
    event OrderDisputed(uint256 indexed orderId, address indexed raisedBy);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error GigNotActive();
    error CannotOrderOwnGig();
    error OrderNotFound();
    error NotOrderClient();
    error NotOrderFreelancer();
    error InvalidOrderStatus(OrderStatus current, OrderStatus required);
    error InvalidTreasury();
    error InvalidFeeBps();
    error NotAuthorized();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _cUSD,
        address _gigsContract,
        address _treasury,
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidTreasury();
        if (_platformFeeBps > 1000) revert InvalidFeeBps(); // max 10%
        cUSD = IERC20(_cUSD);
        gigsContract = IZunoGigs(_gigsContract);
        treasury = _treasury;
        platformFeeBps = _platformFeeBps;
    }

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Place an order for a gig — locks cUSD in escrow
    function placeOrder(uint256 gigId) external nonReentrant returns (uint256 orderId) {
        if (!gigsContract.isGigActive(gigId)) revert GigNotActive();

        address freelancer = gigsContract.getGigOwner(gigId);
        if (freelancer == msg.sender) revert CannotOrderOwnGig();

        uint256 amount = gigsContract.getGigPrice(gigId);
        uint256 fee = (amount * platformFeeBps) / 10_000;

        orderId = nextOrderId++;

        orders[orderId] = Order({
            id: orderId,
            gigId: gigId,
            client: msg.sender,
            freelancer: freelancer,
            amount: amount,
            platformFee: fee,
            status: OrderStatus.InProgress,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        ordersByClient[msg.sender].push(orderId);
        ordersByFreelancer[freelancer].push(orderId);

        // Transfer cUSD from client to this contract
        cUSD.safeTransferFrom(msg.sender, address(this), amount);

        emit OrderPlaced(orderId, gigId, msg.sender, freelancer, amount);
    }

    /// @notice Freelancer marks the order as delivered
    function markDelivered(uint256 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        if (order.freelancer != msg.sender) revert NotOrderFreelancer();
        _requireStatus(order, OrderStatus.InProgress);

        order.status = OrderStatus.Delivered;
        order.updatedAt = block.timestamp;

        emit OrderDelivered(orderId);
    }

    /// @notice Client approves delivery — releases funds to freelancer
    function approveDelivery(uint256 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        if (order.client != msg.sender) revert NotOrderClient();
        _requireStatus(order, OrderStatus.Delivered);

        order.status = OrderStatus.Completed;
        order.updatedAt = block.timestamp;

        uint256 payout = order.amount - order.platformFee;

        // Send platform fee to treasury
        if (order.platformFee > 0) {
            cUSD.safeTransfer(treasury, order.platformFee);
        }

        // Release payout to freelancer
        cUSD.safeTransfer(order.freelancer, payout);

        emit OrderCompleted(orderId, order.freelancer, payout);
    }

    /// @notice Client cancels order before delivery (full refund)
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        if (order.client != msg.sender) revert NotOrderClient();

        // Can only cancel if InProgress (not yet delivered)
        if (order.status != OrderStatus.InProgress) {
            revert InvalidOrderStatus(order.status, OrderStatus.InProgress);
        }

        order.status = OrderStatus.Cancelled;
        order.updatedAt = block.timestamp;

        // Full refund to client
        cUSD.safeTransfer(order.client, order.amount);

        emit OrderCancelled(orderId, order.client, order.amount);
    }

    /// @notice Raise a dispute on a delivered order
    function raiseDispute(uint256 orderId) external nonReentrant {
        Order storage order = _getOrder(orderId);
        if (order.client != msg.sender && order.freelancer != msg.sender) revert NotAuthorized();
        _requireStatus(order, OrderStatus.Delivered);

        order.status = OrderStatus.Disputed;
        order.updatedAt = block.timestamp;

        emit OrderDisputed(orderId, msg.sender);
    }

    /// @notice Resolve a dispute — called by ZunoDispute contract or owner
    /// @param orderId The order to resolve
    /// @param clientRefundBps Basis points to refund to client (0–10000)
    function resolveDispute(uint256 orderId, uint256 clientRefundBps) external nonReentrant {
        // Only owner (or dispute contract set by owner) can resolve
        if (msg.sender != owner()) revert NotAuthorized();
        if (clientRefundBps > 10_000) revert InvalidFeeBps();

        Order storage order = _getOrder(orderId);
        _requireStatus(order, OrderStatus.Disputed);

        order.status = OrderStatus.Completed;
        order.updatedAt = block.timestamp;

        uint256 clientRefund = (order.amount * clientRefundBps) / 10_000;
        uint256 freelancerPayout = order.amount - clientRefund;

        if (clientRefund > 0) {
            cUSD.safeTransfer(order.client, clientRefund);
        }
        if (freelancerPayout > 0) {
            // Deduct platform fee from freelancer portion
            uint256 fee = (freelancerPayout * platformFeeBps) / 10_000;
            uint256 net = freelancerPayout - fee;
            if (fee > 0) cUSD.safeTransfer(treasury, fee);
            cUSD.safeTransfer(order.freelancer, net);
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury = _treasury;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 1000) revert InvalidFeeBps();
        platformFeeBps = _feeBps;
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        if (orders[orderId].id == 0) revert OrderNotFound();
        return orders[orderId];
    }

    function getOrdersByClient(address client) external view returns (uint256[] memory) {
        return ordersByClient[client];
    }

    function getOrdersByFreelancer(address freelancer) external view returns (uint256[] memory) {
        return ordersByFreelancer[freelancer];
    }

    function totalOrders() external view returns (uint256) {
        return nextOrderId - 1;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getOrder(uint256 orderId) internal view returns (Order storage) {
        if (orders[orderId].id == 0) revert OrderNotFound();
        return orders[orderId];
    }

    function _requireStatus(Order storage order, OrderStatus required) internal view {
        if (order.status != required) revert InvalidOrderStatus(order.status, required);
    }
}
