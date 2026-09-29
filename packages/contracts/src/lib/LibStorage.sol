// SPDX-License-Identifier: MIT
// src/lib/LibStorage.sol
pragma solidity ^0.8.24;

library LibStorage {
    bytes32 internal constant SLOT = keccak256("private.airdrop.storage.v2");
    enum Phase {
        Registration,
        Claim,
        Ended
    }

    struct Tier {
        string name;
        uint256 reward;
        uint256 masterKey;
    }

    struct Airdrop {
        string name;
        uint256 budget;
        uint256 claimed;
        uint256 createdAt;
        uint256 context;
        uint256 root;
        Phase phase;
        bool paused;
        Tier[] tiers;
        mapping(uint256 => bool) usedNullifiers;
    }

    struct State {
        mapping(address => bool) owners;
        address[] ownerList;
        address proofVerifier;
        address relayer;
        bool locked;
        uint256 count;
        mapping(uint256 => Airdrop) drops;
        mapping(bytes4 => address) selectorFacet;
        bytes4[] selectors;
        address superOwner;
        address demoFaucet;
        bool demoEnabled;
        mapping(address => address) demoGrants;
    }

    function get() internal pure returns (State storage s) {
        bytes32 slot = SLOT;
        assembly { s.slot := slot }
    }
}
