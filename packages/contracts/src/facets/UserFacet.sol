// SPDX-License-Identifier: MIT
// src/facets/UserFacet.sol
pragma solidity ^0.8.24;
import {LibStorage} from "../lib/LibStorage.sol";
import {LibAirdrop} from "../lib/LibAirdrop.sol";
import {IAirdrop} from "../interfaces/IAirdrop.sol";
import {IVerifier} from "../interfaces/IVerifier.sol";

contract UserFacet is IAirdrop {
    // Mappings stay in storage, so the getter returns only the public fields.
    struct AirdropView {
        string name;
        uint256 budget;
        uint256 claimed;
        uint256 createdAt;
        uint256 context;
        uint256 root;
        LibStorage.Phase phase;
        bool paused;
        LibStorage.Tier[] tiers;
    }

    /// @notice Check a proof and pay its recipient from the shared pool.
    /// @dev Only the relayer can call this. A used nullifier cannot claim again.
    /// @param id Airdrop being claimed.
    /// @param proof Proof made by the user's browser.
    /// @param tierKey User's child tier key.
    /// @param nullifier Hash of the secret and nullifier seed.
    /// @param recipient Wallet that receives the reward.
    function claim(uint256 id, bytes calldata proof, uint256 tierKey, uint256 nullifier, address recipient) external {
        LibStorage.State storage s = LibStorage.get();
        if (msg.sender != s.relayer) revert Unauthorized();
        LibStorage.Airdrop storage d = LibAirdrop.drop(id);
        LibAirdrop.active(d, LibStorage.Phase.Claim);
        LibAirdrop.field(tierKey);
        LibAirdrop.field(nullifier);
        if (recipient == address(0)) revert InvalidInput();
        if (d.usedNullifiers[nullifier]) revert AlreadyClaimed();
        uint256 amount = LibAirdrop.reward(d, tierKey, nullifier);
        if (amount > d.budget - d.claimed) revert InsufficientBudget();
        if (amount > address(this).balance) revert InsufficientPool();
        bytes32[] memory inputs = new bytes32[](4);
        inputs[0] = bytes32(tierKey);
        inputs[1] = bytes32(nullifier);
        inputs[2] = bytes32(d.root);
        inputs[3] = bytes32(uint256(uint160(recipient)));
        LibAirdrop.enter();
        try IVerifier(s.proofVerifier).verify(proof, inputs) returns (bool valid) {
            if (!valid) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }
        d.usedNullifiers[nullifier] = true;
        d.claimed += amount;
        emit Claimed(id, nullifier, recipient, amount, block.timestamp);
        LibAirdrop.send(recipient, amount);
        LibAirdrop.leave();
    }

    // Number of airdrops created so far.
    function airdropCount() external view returns (uint256) {
        return LibStorage.get().count;
    }

    /// @notice Read an airdrop's public data.
    /// @dev Used by both app screens and the server.
    /// @param id Airdrop to read.
    function getAirdrop(uint256 id) external view returns (AirdropView memory) {
        LibStorage.Airdrop storage d = LibAirdrop.drop(id);
        return AirdropView(d.name, d.budget, d.claimed, d.createdAt, d.context, d.root, d.phase, d.paused, d.tiers);
    }

    /// @notice Check whether a nullifier has already claimed.
    /// @dev The result belongs to this airdrop only.
    /// @param id Airdrop to check.
    /// @param nullifier Hash from the proof's public inputs.
    function isClaimed(uint256 id, uint256 nullifier) external view returns (bool) {
        return LibAirdrop.drop(id).usedNullifiers[nullifier];
    }

    // Addresses and roles used by the app and server.
    function verifier() external view returns (address) {
        return LibStorage.get().proofVerifier;
    }

    function relayer() external view returns (address) {
        return LibStorage.get().relayer;
    }

    function isOwner(address account) external view returns (bool) {
        return LibAirdrop.isOwner(account);
    }

    function owners() external view returns (address[] memory) {
        return LibStorage.get().ownerList;
    }

    function poolBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // The deployer keeps this role for the lifetime of the diamond.
    function superOwner() external view returns (address) {
        return LibStorage.get().superOwner;
    }

    // One approved faucet may grant temporary demo access.
    function demoAccess() external view returns (address faucet, bool enabled) {
        LibStorage.State storage s = LibStorage.get();
        return (s.demoFaucet, s.demoEnabled);
    }
}
