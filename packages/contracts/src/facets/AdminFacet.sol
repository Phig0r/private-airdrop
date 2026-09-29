// SPDX-License-Identifier: MIT
// src/facets/AdminFacet.sol
pragma solidity ^0.8.24;
import {LibStorage} from "../lib/LibStorage.sol";
import {LibAirdrop} from "../lib/LibAirdrop.sol";
import {IAirdrop} from "../interfaces/IAirdrop.sol";

contract AdminFacet is IAirdrop {
    /// @notice Create an airdrop with an empty root and no tiers.
    /// @dev Only owners can create it. The budget is a cap, not a deposit.
    /// @param name Name shown in the app.
    /// @param budget Maximum total reward in wei.
    function createAirdrop(string calldata name, uint256 budget) external returns (uint256 id) {
        LibAirdrop.owner();
        if (bytes(name).length == 0 || bytes(name).length > 60 || budget == 0) revert InvalidInput();
        LibStorage.State storage s = LibStorage.get();
        id = ++s.count;
        LibStorage.Airdrop storage d = s.drops[id];
        d.name = name;
        d.budget = budget;
        d.createdAt = block.timestamp;
        d.context = uint256(keccak256(abi.encode(block.chainid, address(this), id))) % LibAirdrop.FIELD;
        emit AirdropCreated(id, name, budget, block.timestamp);
    }

    /// @notice Publish the root and tiers, then open claims.
    /// @dev Use the same master keys that the server used during registration.
    /// @param id Airdrop to open.
    /// @param root Root of the finished Merkle tree.
    /// @param tiers Names, rewards in wei and master keys, in server order.
    function startClaimPhase(uint256 id, uint256 root, LibStorage.Tier[] calldata tiers) external {
        LibAirdrop.owner();
        LibStorage.Airdrop storage d = LibAirdrop.drop(id);
        LibAirdrop.active(d, LibStorage.Phase.Registration);
        LibAirdrop.field(root);
        if (root == 0 || tiers.length == 0 || tiers.length > 32) revert InvalidInput();
        for (uint256 i; i < tiers.length; ++i) {
            LibStorage.Tier calldata tier = tiers[i];
            LibAirdrop.field(tier.masterKey);
            if (bytes(tier.name).length > 40 || tier.masterKey == 0 || tier.reward == 0 || tier.reward > d.budget) {
                revert InvalidTier();
            }
            for (uint256 j; j < i; ++j) {
                if (tiers[j].masterKey == tier.masterKey) revert InvalidTier();
            }
            d.tiers.push(tier);
        }
        d.root = root;
        d.phase = LibStorage.Phase.Claim;
        emit ClaimsOpened(id, root, block.timestamp);
    }

    /// @notice Pause or resume an airdrop.
    /// @dev An ended airdrop cannot be reopened.
    /// @param id Airdrop to update.
    /// @param paused True to pause, false to resume.
    function setPaused(uint256 id, bool paused) external {
        LibAirdrop.owner();
        LibStorage.Airdrop storage d = LibAirdrop.drop(id);
        if (d.phase == LibStorage.Phase.Ended) revert WrongPhase();
        d.paused = paused;
        emit PauseChanged(id, paused, block.timestamp);
    }

    /// @notice Close an airdrop permanently.
    /// @dev ETH stays in the shared pool for other airdrops.
    /// @param id Airdrop to close.
    function endAirdrop(uint256 id) external {
        LibAirdrop.owner();
        LibStorage.Airdrop storage d = LibAirdrop.drop(id);
        if (d.phase == LibStorage.Phase.Ended) revert WrongPhase();
        d.phase = LibStorage.Phase.Ended;
        emit AirdropEnded(id, block.timestamp);
    }

    /// @notice Add or remove owner accounts.
    /// @dev Only the super owner grants permanent roles. Its own role cannot be removed.
    /// @param accounts Wallets to update.
    /// @param enabled True to add these wallets, false to remove them.
    function setOwners(address[] calldata accounts, bool enabled) external {
        LibAirdrop.superOwner();
        LibStorage.State storage s = LibStorage.get();
        for (uint256 i; i < accounts.length; ++i) {
            address account = accounts[i];
            if (account == address(0)) revert InvalidInput();
            if (!enabled && account == s.superOwner) revert LastOwner();
            if (!enabled) delete s.demoGrants[account];
            if (s.owners[account] == enabled) continue;
            if (enabled) {
                s.ownerList.push(account);
            } else {
                if (s.ownerList.length == 1) revert LastOwner();
                for (uint256 j; j < s.ownerList.length; ++j) {
                    if (s.ownerList[j] == account) {
                        s.ownerList[j] = s.ownerList[s.ownerList.length - 1];
                        s.ownerList.pop();
                        break;
                    }
                }
            }
            s.owners[account] = enabled;
            emit OwnerUpdated(account, enabled, block.timestamp);
        }
    }

    /// @notice Change the wallet allowed to submit claims.
    /// @dev This is a server wallet, not the proof verifier contract.
    /// @param relayer New relayer wallet.
    function setRelayer(address relayer) external {
        LibAirdrop.superOwner();
        if (relayer == address(0)) revert InvalidInput();
        LibStorage.get().relayer = relayer;
        emit RelayerUpdated(relayer, block.timestamp);
    }

    /// @notice Add ETH to the pool used by every airdrop.
    /// @dev Anyone can fund the pool. Funding gives no owner rights.
    function fundPool() external payable {
        if (msg.value == 0) revert InvalidInput();
        emit PoolFunded(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Withdraw ETH from the shared pool.
    /// @dev Only the super owner can withdraw. Budgets do not reserve pool funds.
    /// @param recipient Wallet receiving the ETH.
    /// @param amount Amount to withdraw in wei.
    function withdraw(address recipient, uint256 amount) external {
        LibAirdrop.superOwner();
        if (recipient == address(0) || amount == 0) revert InvalidInput();
        if (amount > address(this).balance) revert InsufficientPool();
        LibAirdrop.enter();
        LibAirdrop.send(recipient, amount);
        emit PoolWithdrawn(recipient, amount, block.timestamp);
        LibAirdrop.leave();
    }

    /// @notice Approve a demo faucet and turn its access on or off.
    /// @dev Disabling it also disables the roles it granted. Permanent owners remain active.
    /// @param faucet Faucet contract, or zero to remove it while disabled.
    /// @param enabled Whether testers may request and use demo access.
    function setDemoFaucet(address faucet, bool enabled) external {
        LibAirdrop.superOwner();
        if (faucet == address(0)) {
            if (enabled) revert InvalidInput();
        } else {
            if (faucet.code.length == 0) revert InvalidInput();
            (bool ok, bytes memory result) = faucet.staticcall(abi.encodeWithSignature("diamond()"));
            if (!ok || result.length != 32 || abi.decode(result, (address)) != address(this)) revert InvalidInput();
        }
        LibStorage.State storage s = LibStorage.get();
        s.demoFaucet = faucet;
        s.demoEnabled = enabled;
        emit DemoFaucetUpdated(faucet, enabled, block.timestamp);
    }

    /// @notice Give a tester access to airdrop management.
    /// @dev Only the approved, enabled faucet can call this function.
    /// @param account Tester that requested access from the faucet.
    function grantDemoOwner(address account) external {
        LibStorage.State storage s = LibStorage.get();
        if (!s.demoEnabled || msg.sender != s.demoFaucet) revert DemoUnavailable();
        if (account == address(0)) revert InvalidInput();
        s.demoGrants[account] = msg.sender;
        emit DemoOwnerGranted(account, msg.sender, block.timestamp);
    }
}
