// SPDX-License-Identifier: MIT
// src/lib/LibDeployment.sol
pragma solidity ^0.8.24;
import {AdminFacet} from "../facets/AdminFacet.sol";
import {UserFacet} from "../facets/UserFacet.sol";
import {IDiamondCut} from "../interfaces/IDiamond.sol";

/// @dev Shared by deployment script and tests; selectors cannot drift between them.
library LibDeployment {
    /// @dev Build the same selector list for deployment and tests.
    /// @param admin Deployed admin facet.
    /// @param user Deployed user facet.
    function cuts(address admin, address user) internal pure returns (IDiamondCut.FacetCut[] memory result) {
        bytes4[] memory a = new bytes4[](10);
        a[0] = AdminFacet.createAirdrop.selector;
        a[1] = AdminFacet.startClaimPhase.selector;
        a[2] = AdminFacet.setPaused.selector;
        a[3] = AdminFacet.endAirdrop.selector;
        a[4] = AdminFacet.setOwners.selector;
        a[5] = AdminFacet.setRelayer.selector;
        a[6] = AdminFacet.fundPool.selector;
        a[7] = AdminFacet.withdraw.selector;
        a[8] = AdminFacet.setDemoFaucet.selector;
        a[9] = AdminFacet.grantDemoOwner.selector;
        bytes4[] memory u = new bytes4[](11);
        u[0] = UserFacet.claim.selector;
        u[1] = UserFacet.airdropCount.selector;
        u[2] = UserFacet.getAirdrop.selector;
        u[3] = UserFacet.isClaimed.selector;
        u[4] = UserFacet.verifier.selector;
        u[5] = UserFacet.relayer.selector;
        u[6] = UserFacet.isOwner.selector;
        u[7] = UserFacet.owners.selector;
        u[8] = UserFacet.poolBalance.selector;
        u[9] = UserFacet.superOwner.selector;
        u[10] = UserFacet.demoAccess.selector;
        result = new IDiamondCut.FacetCut[](2);
        result[0] = IDiamondCut.FacetCut(admin, IDiamondCut.FacetCutAction.Add, a);
        result[1] = IDiamondCut.FacetCut(user, IDiamondCut.FacetCutAction.Add, u);
    }
}
