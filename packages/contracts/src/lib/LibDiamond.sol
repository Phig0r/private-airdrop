// SPDX-License-Identifier: MIT
// src/lib/LibDiamond.sol
pragma solidity ^0.8.24;
import {IAirdrop} from "../interfaces/IAirdrop.sol";
import {LibStorage} from "./LibStorage.sol";
import {IDiamondCut, IDiamondErrors} from "../interfaces/IDiamond.sol";

library LibDiamond {
    /// @dev Apply selector changes and run the optional initializer.
    /// @param changes Functions to add, replace or remove.
    /// @param init Initializer contract, or the zero address.
    /// @param data Encoded initializer call.
    function cut(IDiamondCut.FacetCut[] memory changes, address init, bytes memory data) internal {
        LibStorage.State storage s = LibStorage.get();
        for (uint256 i; i < changes.length; ++i) {
            IDiamondCut.FacetCut memory c = changes[i];
            if (c.functionSelectors.length == 0) revert IDiamondErrors.InvalidCut();
            if (c.action == IDiamondCut.FacetCutAction.Remove) {
                if (c.facetAddress != address(0)) revert IDiamondErrors.InvalidCut();
            } else if (c.facetAddress.code.length == 0 || c.facetAddress == address(this)) {
                revert IDiamondErrors.InvalidCut();
            }
            for (uint256 j; j < c.functionSelectors.length; ++j) {
                bytes4 selector = c.functionSelectors[j];
                address old = s.selectorFacet[selector];
                if (old == address(this)) revert IDiamondErrors.InvalidCut();
                if (c.action == IDiamondCut.FacetCutAction.Add) {
                    if (old != address(0)) revert IDiamondErrors.InvalidCut();
                    s.selectors.push(selector);
                } else {
                    if (old == address(0) || old == c.facetAddress) revert IDiamondErrors.InvalidCut();
                    if (c.action == IDiamondCut.FacetCutAction.Remove) removeSelector(selector);
                }
                s.selectorFacet[selector] = c.facetAddress;
            }
        }
        emit IDiamondCut.DiamondCut(changes, init, data);
        emit IAirdrop.DiamondUpdated(msg.sender, block.timestamp);
        if (init == address(0)) {
            if (data.length != 0) revert IDiamondErrors.InvalidCut();
        } else {
            if (init.code.length == 0 || data.length == 0) revert IDiamondErrors.InvalidCut();
            (bool ok, bytes memory result) = init.delegatecall(data);
            if (!ok) {
                if (result.length == 0) revert IDiamondErrors.InitializationFailed();
                assembly { revert(add(result, 32), mload(result)) }
            }
        }
    }

    // Remove a selector without leaving a gap in the array.
    function removeSelector(bytes4 selector) private {
        bytes4[] storage selectors = LibStorage.get().selectors;
        for (uint256 i; i < selectors.length; ++i) {
            if (selectors[i] == selector) {
                selectors[i] = selectors[selectors.length - 1];
                selectors.pop();
                return;
            }
        }
    }
}
