// SPDX-License-Identifier: MIT
// script/Deploy.s.sol
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Diamond} from "../src/Diamond.sol";
import {DemoFaucet} from "../src/DemoFaucet.sol";
import {AdminFacet} from "../src/facets/AdminFacet.sol";
import {UserFacet} from "../src/facets/UserFacet.sol";
import {HonkVerifier} from "../src/verifier/Verifier.sol";
import {LibDeployment} from "../src/lib/LibDeployment.sol";

contract Deploy is Script {
    /// @notice Deploy the app and its optional review faucet.
    /// @dev DIAMOND_OWNER must be the broadcasting wallet; it becomes the super owner.
    function run() external returns (Diamond diamond) {
        address owner = vm.envAddress("DIAMOND_OWNER");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy the application code.
        AdminFacet adminFacet = new AdminFacet();
        UserFacet userFacet = new UserFacet();

        // 2. Deploy the verifier generated from the same circuit as the app.
        HonkVerifier proofVerifier = new HonkVerifier();

        // 3. Set the roles, verifier and selector routes in one constructor call.
        diamond = new Diamond(
            owner, address(proofVerifier), relayer, LibDeployment.cuts(address(adminFacet), address(userFacet))
        );

        // 4. Register a separate role faucet. Start disabled unless explicitly enabled.
        DemoFaucet faucet = new DemoFaucet(address(diamond));
        AdminFacet(address(diamond)).setDemoFaucet(address(faucet), vm.envOr("DEMO_ENABLED", false));

        vm.stopBroadcast();
    }
}
