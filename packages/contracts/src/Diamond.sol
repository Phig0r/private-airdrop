// SPDX-License-Identifier: MIT
// src/Diamond.sol
pragma solidity ^0.8.24;
import {IDiamondCut, IDiamondLoupe, IDiamondErrors} from "./interfaces/IDiamond.sol";
import {IAirdrop} from "./interfaces/IAirdrop.sol";
import {LibStorage} from "./lib/LibStorage.sol";
import {LibDiamond} from "./lib/LibDiamond.sol";
import {LibAirdrop} from "./lib/LibAirdrop.sol";

/// @notice EIP-2535 routing, cut and loupe are immutable; business logic has two facets.
contract Diamond is IDiamondCut, IDiamondLoupe, IDiamondErrors {
    /// @notice Set up the diamond and its first owner.
    /// @dev The verifier stays a separate contract; only the two facets are routed.
    /// @param initialOwner First account allowed to manage the app.
    /// @param proofVerifier Generated verifier contract.
    /// @param relayer Server wallet allowed to send claims.
    /// @param initialCut Facet addresses and their function selectors.
    constructor(address initialOwner, address proofVerifier, address relayer, FacetCut[] memory initialCut) {
        if (initialOwner != msg.sender || relayer == address(0) || proofVerifier.code.length == 0) {
            revert IAirdrop.InvalidInput();
        }
        LibStorage.State storage s = LibStorage.get();
        s.owners[initialOwner] = true;
        s.superOwner = initialOwner;
        s.ownerList.push(initialOwner);
        s.proofVerifier = proofVerifier;
        s.relayer = relayer;
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = Diamond.diamondCut.selector;
        selectors[1] = Diamond.facets.selector;
        selectors[2] = IDiamondLoupe.facetFunctionSelectors.selector;
        selectors[3] = IDiamondLoupe.facetAddresses.selector;
        selectors[4] = Diamond.facetAddress.selector;
        selectors[5] = Diamond.supportsInterface.selector;
        for (uint256 i; i < selectors.length; ++i) {
            s.selectorFacet[selectors[i]] = address(this);
            s.selectors.push(selectors[i]);
        }
        FacetCut[] memory immutableCut = new FacetCut[](1);
        immutableCut[0] = FacetCut(address(this), FacetCutAction.Add, selectors);
        emit DiamondCut(immutableCut, address(0), "");
        emit IAirdrop.OwnerUpdated(initialOwner, true, block.timestamp);
        emit IAirdrop.RelayerUpdated(relayer, block.timestamp);
        LibDiamond.cut(initialCut, address(0), "");
    }

    /// @notice Add, replace or remove facet functions.
    /// @dev Only the super owner can upgrade. Storage must remain compatible.
    /// @param changes Selector changes to apply together.
    /// @param init Optional contract to run once after the changes.
    /// @param data Encoded call for that contract, or empty bytes.
    function diamondCut(FacetCut[] calldata changes, address init, bytes calldata data) external {
        LibAirdrop.superOwner();
        LibAirdrop.enter();
        LibDiamond.cut(changes, init, data);
        LibAirdrop.leave();
    }

    // Report supported diamond interfaces.
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == type(IDiamondCut).interfaceId || id == type(IDiamondLoupe).interfaceId;
    }

    // Find the facet that handles a selector.
    function facetAddress(bytes4 selector) external view returns (address) {
        return LibStorage.get().selectorFacet[selector];
    }

    // List the selectors handled by one facet.
    function facetFunctionSelectors(address facet) public view returns (bytes4[] memory result) {
        LibStorage.State storage s = LibStorage.get();
        uint256 count;
        for (uint256 i; i < s.selectors.length; ++i) {
            if (s.selectorFacet[s.selectors[i]] == facet) ++count;
        }
        result = new bytes4[](count);
        uint256 next;
        for (uint256 i; i < s.selectors.length; ++i) {
            if (s.selectorFacet[s.selectors[i]] == facet) result[next++] = s.selectors[i];
        }
    }

    // List each facet once, including immutable diamond functions.
    function facetAddresses() public view returns (address[] memory result) {
        LibStorage.State storage s = LibStorage.get();
        address[] memory buffer = new address[](s.selectors.length);
        uint256 count;
        for (uint256 i; i < s.selectors.length; ++i) {
            address candidate = s.selectorFacet[s.selectors[i]];
            bool found;
            for (uint256 j; j < count; ++j) {
                if (buffer[j] == candidate) {
                    found = true;
                    break;
                }
            }
            if (!found) buffer[count++] = candidate;
        }
        result = new address[](count);
        for (uint256 i; i < count; ++i) {
            result[i] = buffer[i];
        }
    }

    // Return facet addresses with their selectors.
    function facets() external view returns (Facet[] memory result) {
        address[] memory addresses = facetAddresses();
        result = new Facet[](addresses.length);
        for (uint256 i; i < addresses.length; ++i) {
            result[i] = Facet(addresses[i], facetFunctionSelectors(addresses[i]));
        }
    }

    // Direct ETH transfers also fund the shared pool.
    receive() external payable {
        emit IAirdrop.PoolFunded(msg.sender, msg.value, block.timestamp);
    }

    // Run the selected facet against the diamond storage.
    fallback() external payable {
        address facet = LibStorage.get().selectorFacet[msg.sig];
        if (facet == address(0)) revert UnknownSelector();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
