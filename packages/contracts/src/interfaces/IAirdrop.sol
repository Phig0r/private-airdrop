// SPDX-License-Identifier: MIT
// src/interfaces/IAirdrop.sol
pragma solidity ^0.8.24;

interface IAirdrop {
    error Unauthorized();
    error InvalidInput();
    error UnknownAirdrop();
    error WrongPhase();
    error Paused();
    error InvalidTier();
    error AlreadyClaimed();
    error InvalidProof();
    error InsufficientBudget();
    error InsufficientPool();
    error TransferFailed();
    error Reentrancy();
    error LastOwner();
    error DemoUnavailable();
    event AirdropCreated(uint256 indexed id, string name, uint256 budget, uint256 timestamp);
    event ClaimsOpened(uint256 indexed id, uint256 root, uint256 timestamp);
    event PauseChanged(uint256 indexed id, bool paused, uint256 timestamp);
    event AirdropEnded(uint256 indexed id, uint256 timestamp);
    event Claimed(
        uint256 indexed id, uint256 indexed nullifier, address indexed recipient, uint256 amount, uint256 timestamp
    );
    event OwnerUpdated(address indexed account, bool enabled, uint256 timestamp);
    event RelayerUpdated(address indexed relayer, uint256 timestamp);
    event PoolFunded(address indexed sender, uint256 amount, uint256 timestamp);
    event DiamondUpdated(address indexed sender, uint256 timestamp);
    event PoolWithdrawn(address indexed recipient, uint256 amount, uint256 timestamp);
    event DemoFaucetUpdated(address indexed faucet, bool enabled, uint256 timestamp);
    event DemoOwnerGranted(address indexed account, address indexed faucet, uint256 timestamp);
}
