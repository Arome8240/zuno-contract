// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ZunoTreasury
/// @notice Receives and manages platform fees for the Zuno marketplace
contract ZunoTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable cUSD;
    uint256 public totalFeesCollected;

    // ─── Events ──────────────────────────────────────────────────────────────

    event FeesReceived(address indexed from, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error ZeroAmount();
    error InvalidRecipient();
    error InsufficientBalance();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _cUSD) Ownable(msg.sender) {
        cUSD = IERC20(_cUSD);
    }

    // ─── External Functions ──────────────────────────────────────────────────

    /// @notice Withdraw accumulated cUSD fees to a recipient (owner only)
    /// @param to Recipient address
    /// @param amount Amount of cUSD to withdraw
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();

        uint256 bal = cUSD.balanceOf(address(this));
        if (amount > bal) revert InsufficientBalance();

        cUSD.safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Withdraw all accumulated fees to owner
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 bal = cUSD.balanceOf(address(this));
        if (bal == 0) revert ZeroAmount();

        cUSD.safeTransfer(owner(), bal);

        emit FeesWithdrawn(owner(), bal);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /// @notice Current cUSD balance held in treasury
    function balance() external view returns (uint256) {
        return cUSD.balanceOf(address(this));
    }
}
