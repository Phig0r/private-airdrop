// SPDX-License-Identifier: MIT
// src/lib/LibAirdrop.sol
pragma solidity ^0.8.24;
import {LibStorage} from "./LibStorage.sol";
import {IAirdrop} from "../interfaces/IAirdrop.sol";

library LibAirdrop {
    uint256 internal constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    /// @dev Reject numbers outside the circuit field.
    /// @param value Number to check.
    function field(uint256 value) internal pure {
        if (value >= FIELD) revert IAirdrop.InvalidInput();
    }

    /// @dev Find an existing airdrop in shared storage.
    /// @param id Airdrop ID.
    function drop(uint256 id) internal view returns (LibStorage.Airdrop storage d) {
        d = LibStorage.get().drops[id];
        if (id == 0 || id > LibStorage.get().count) revert IAirdrop.UnknownAirdrop();
    }

    // Only an account with the owner role may continue.
    function owner() internal view {
        if (!isOwner(msg.sender)) revert IAirdrop.Unauthorized();
    }

    // Demo grants work only while their issuing faucet is active.
    function isOwner(address account) internal view returns (bool) {
        LibStorage.State storage s = LibStorage.get();
        return
            s.owners[account] || (s.demoEnabled && s.demoFaucet != address(0) && s.demoGrants[account] == s.demoFaucet);
    }

    // Only the original deployer controls funds and privileged settings.
    function superOwner() internal view {
        if (msg.sender != LibStorage.get().superOwner) revert IAirdrop.Unauthorized();
    }

    /// @dev Check the phase and pause flag before an action.
    /// @param d Airdrop being used.
    /// @param phase Phase required by the caller.
    function active(LibStorage.Airdrop storage d, LibStorage.Phase phase) internal view {
        if (d.phase != phase) revert IAirdrop.WrongPhase();
        if (d.paused) revert IAirdrop.Paused();
    }

    // Lock protected calls before sending ETH or calling another contract.
    function enter() internal {
        if (LibStorage.get().locked) revert IAirdrop.Reentrancy();
        LibStorage.get().locked = true;
    }

    // Clear the lock after a successful call. Reverts undo it automatically.
    function leave() internal {
        LibStorage.get().locked = false;
    }

    /// @dev Send ETH and undo the claim if the receiver rejects it.
    /// @param recipient Wallet or contract to pay.
    /// @param amount Payment in wei.
    function send(address recipient, uint256 amount) internal {
        (bool ok,) = payable(recipient).call{value: amount}("");
        if (!ok) revert IAirdrop.TransferFailed();
    }

    /// @dev Match the Rust HMAC-SHA256 function, using 32-byte big-endian fields.
    /// @param master Published master key for one tier.
    /// @param context Fixed context for this airdrop.
    /// @param nullifier Hash of the user secret and seed.
    function deriveTierKey(uint256 master, uint256 context, uint256 nullifier) internal pure returns (uint256) {
        bytes32 ipad = bytes32(uint256(0x3636363636363636363636363636363636363636363636363636363636363636));
        bytes32 opad = bytes32(uint256(0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c));
        bytes32 inner = sha256(
            abi.encodePacked(
                bytes32(master) ^ ipad, ipad, "private-airdrop/tier-key/v1", bytes32(context), bytes32(nullifier)
            )
        );
        return uint256(sha256(abi.encodePacked(bytes32(master) ^ opad, opad, inner))) % FIELD;
    }

    /// @dev Find the tier whose master key produces this child key.
    /// @param d Airdrop with its published tiers.
    /// @param child Child key from the proof.
    /// @param nullifier Nullifier from the same proof.
    function reward(LibStorage.Airdrop storage d, uint256 child, uint256 nullifier) internal view returns (uint256) {
        for (uint256 i; i < d.tiers.length; ++i) {
            if (deriveTierKey(d.tiers[i].masterKey, d.context, nullifier) == child) return d.tiers[i].reward;
        }
        revert IAirdrop.InvalidTier();
    }
}
