// SPDX-License-Identifier: MIT
// src/DemoFaucet.sol
pragma solidity ^0.8.24;

import {AdminFacet} from "./facets/AdminFacet.sol";

/// @notice Lets reviewers request a demo admin role, not ETH.
contract DemoFaucet {
    address public immutable diamond;

    /// @param target Diamond whose super owner must approve this faucet.
    constructor(address target) {
        diamond = target;
    }

    /// @notice Request demo access for your own wallet.
    /// @dev The diamond checks that this faucet is approved and enabled.
    function requestRole() external {
        AdminFacet(diamond).grantDemoOwner(msg.sender);
    }
}
