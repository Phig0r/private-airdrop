// SPDX-License-Identifier: MIT
// src/interfaces/IDiamond.sol
pragma solidity ^0.8.24;

interface IDiamondCut {
    enum FacetCutAction {
        Add,
        Replace,
        Remove
    }

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }
    event DiamondCut(FacetCut[] cut, address init, bytes data);
    function diamondCut(FacetCut[] calldata cut, address init, bytes calldata data) external;
}

interface IDiamondLoupe {
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }
    function facets() external view returns (Facet[] memory);
    function facetFunctionSelectors(address facet) external view returns (bytes4[] memory);
    function facetAddresses() external view returns (address[] memory);
    function facetAddress(bytes4 selector) external view returns (address);
}

interface IDiamondErrors {
    error InvalidCut();
    error UnknownSelector();
    error InitializationFailed();
}
