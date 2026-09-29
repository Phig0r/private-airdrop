// SPDX-License-Identifier: MIT
// src/interfaces/IVerifier.sol
pragma solidity ^0.8.24;

/// @dev Adapter boundary for the circuit's generated UltraHonk verifier.
interface IVerifier {
    /// @notice Check a circuit proof.
    /// @dev Returns true for a valid proof; invalid proofs can also revert.
    /// @param proof Encoded UltraHonk proof.
    /// @param publicInputs Tier key, nullifier, root and recipient, in that order.
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}
