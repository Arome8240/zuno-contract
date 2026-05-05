// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZunoGigs
/// @notice Manages gig listings on the Zuno freelance marketplace
contract ZunoGigs is Ownable, ReentrancyGuard {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct Gig {
        uint256 id;
        address owner;
        string title;
        string description;
        string category;
        string[] tags;
        uint256 price;        // in cUSD (18 decimals)
        uint256 deliveryDays;
        string metadataIpfsHash; // IPFS CID for media/metadata
        bool active;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 private nextGigId = 1;
    mapping(uint256 => Gig) private gigs;
    mapping(address => uint256[]) private gigsByOwner;

    // ─── Events ──────────────────────────────────────────────────────────────

    event GigCreated(uint256 indexed gigId, address indexed owner, string title, uint256 price);
    event GigUpdated(uint256 indexed gigId, address indexed owner, string title, uint256 price);
    event GigDeleted(uint256 indexed gigId, address indexed owner);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error GigNotFound();
    error NotGigOwner();
    error InvalidTitle();
    error InvalidPrice();
    error InvalidDeliveryDays();
    error GigNotActive();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Create a new gig listing
    function createGig(
        string calldata title,
        string calldata description,
        string calldata category,
        string[] memory tags,
        uint256 price,
        uint256 deliveryDays,
        string calldata metadataIpfsHash
    ) external nonReentrant returns (uint256 gigId) {
        if (bytes(title).length == 0) revert InvalidTitle();
        if (price == 0) revert InvalidPrice();
        if (deliveryDays == 0) revert InvalidDeliveryDays();

        gigId = nextGigId++;

        gigs[gigId] = Gig({
            id: gigId,
            owner: msg.sender,
            title: title,
            description: description,
            category: category,
            tags: tags,
            price: price,
            deliveryDays: deliveryDays,
            metadataIpfsHash: metadataIpfsHash,
            active: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        gigsByOwner[msg.sender].push(gigId);

        emit GigCreated(gigId, msg.sender, title, price);
    }

    /// @notice Update an existing gig (owner only)
    function updateGig(
        uint256 gigId,
        string calldata title,
        string calldata description,
        string calldata category,
        string[] memory tags,
        uint256 price,
        uint256 deliveryDays,
        string calldata metadataIpfsHash
    ) external nonReentrant {
        Gig storage gig = _getActiveGig(gigId);
        if (gig.owner != msg.sender) revert NotGigOwner();
        if (bytes(title).length == 0) revert InvalidTitle();
        if (price == 0) revert InvalidPrice();
        if (deliveryDays == 0) revert InvalidDeliveryDays();

        gig.title = title;
        gig.description = description;
        gig.category = category;
        gig.tags = tags;
        gig.price = price;
        gig.deliveryDays = deliveryDays;
        gig.metadataIpfsHash = metadataIpfsHash;
        gig.updatedAt = block.timestamp;

        emit GigUpdated(gigId, msg.sender, title, price);
    }

    /// @notice Soft-delete a gig (owner only) — marks as inactive
    function deleteGig(uint256 gigId) external nonReentrant {
        Gig storage gig = _getActiveGig(gigId);
        if (gig.owner != msg.sender) revert NotGigOwner();

        gig.active = false;
        gig.updatedAt = block.timestamp;

        emit GigDeleted(gigId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Get a gig by ID
    function getGig(uint256 gigId) external view returns (Gig memory) {
        if (gigs[gigId].id == 0) revert GigNotFound();
        return gigs[gigId];
    }

    /// @notice Get all gig IDs owned by an address
    function getGigsByOwner(address owner) external view returns (uint256[] memory) {
        return gigsByOwner[owner];
    }

    /// @notice Check if a gig exists and is active
    function isGigActive(uint256 gigId) external view returns (bool) {
        return gigs[gigId].id != 0 && gigs[gigId].active;
    }

    /// @notice Get the price of an active gig
    function getGigPrice(uint256 gigId) external view returns (uint256) {
        if (gigs[gigId].id == 0) revert GigNotFound();
        if (!gigs[gigId].active) revert GigNotActive();
        return gigs[gigId].price;
    }

    /// @notice Get the owner of a gig
    function getGigOwner(uint256 gigId) external view returns (address) {
        if (gigs[gigId].id == 0) revert GigNotFound();
        return gigs[gigId].owner;
    }

    /// @notice Total gigs ever created (including deleted)
    function totalGigs() external view returns (uint256) {
        return nextGigId - 1;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getActiveGig(uint256 gigId) internal view returns (Gig storage) {
        if (gigs[gigId].id == 0) revert GigNotFound();
        if (!gigs[gigId].active) revert GigNotActive();
        return gigs[gigId];
    }
}
