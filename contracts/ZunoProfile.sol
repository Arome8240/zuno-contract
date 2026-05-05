// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZunoProfile
/// @notice On-chain user profile registry for the Zuno freelance marketplace
contract ZunoProfile is Ownable, ReentrancyGuard {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct Profile {
        string displayName;
        string bio;
        string avatarIpfsHash; // IPFS CID for avatar image
        string[] skills;
        bool isFreelancer;
        bool isClient;
        bool exists;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => Profile) private profiles;
    address[] private profileAddresses;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ProfileCreated(address indexed user, string displayName, bool isFreelancer, bool isClient);
    event ProfileUpdated(address indexed user, string displayName);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error ProfileAlreadyExists();
    error ProfileNotFound();
    error InvalidDisplayName();
    error MustHaveAtLeastOneRole();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Create a new profile for the caller
    function createProfile(
        string calldata displayName,
        string calldata bio,
        string calldata avatarIpfsHash,
        string[] memory skills,
        bool freelancer,
        bool client
    ) external nonReentrant {
        if (profiles[msg.sender].exists) revert ProfileAlreadyExists();
        if (bytes(displayName).length == 0) revert InvalidDisplayName();
        if (!freelancer && !client) revert MustHaveAtLeastOneRole();

        profiles[msg.sender] = Profile({
            displayName: displayName,
            bio: bio,
            avatarIpfsHash: avatarIpfsHash,
            skills: skills,
            isFreelancer: freelancer,
            isClient: client,
            exists: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        profileAddresses.push(msg.sender);

        emit ProfileCreated(msg.sender, displayName, freelancer, client);
    }

    /// @notice Update an existing profile
    function updateProfile(
        string calldata displayName,
        string calldata bio,
        string calldata avatarIpfsHash,
        string[] memory skills,
        bool freelancer,
        bool client
    ) external nonReentrant {
        if (!profiles[msg.sender].exists) revert ProfileNotFound();
        if (bytes(displayName).length == 0) revert InvalidDisplayName();
        if (!freelancer && !client) revert MustHaveAtLeastOneRole();

        Profile storage profile = profiles[msg.sender];
        profile.displayName = displayName;
        profile.bio = bio;
        profile.avatarIpfsHash = avatarIpfsHash;
        profile.skills = skills;
        profile.isFreelancer = freelancer;
        profile.isClient = client;
        profile.updatedAt = block.timestamp;

        emit ProfileUpdated(msg.sender, displayName);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Get a profile by wallet address
    function getProfile(address user) external view returns (Profile memory) {
        if (!profiles[user].exists) revert ProfileNotFound();
        return profiles[user];
    }

    /// @notice Check if a wallet has a profile
    function hasProfile(address user) external view returns (bool) {
        return profiles[user].exists;
    }

    /// @notice Check if a wallet is registered as a freelancer
    function isFreelancer(address user) external view returns (bool) {
        return profiles[user].exists && profiles[user].isFreelancer;
    }

    /// @notice Check if a wallet is registered as a client
    function isClient(address user) external view returns (bool) {
        return profiles[user].exists && profiles[user].isClient;
    }

    /// @notice Get total number of registered profiles
    function totalProfiles() external view returns (uint256) {
        return profileAddresses.length;
    }
}
