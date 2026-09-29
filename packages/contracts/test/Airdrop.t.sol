// SPDX-License-Identifier: MIT
// test/Airdrop.t.sol
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {Diamond} from "../src/Diamond.sol";
import {DemoFaucet} from "../src/DemoFaucet.sol";
import {AdminFacet} from "../src/facets/AdminFacet.sol";
import {UserFacet} from "../src/facets/UserFacet.sol";
import {LibDeployment} from "../src/lib/LibDeployment.sol";
import {LibAirdrop} from "../src/lib/LibAirdrop.sol";
import {LibStorage} from "../src/lib/LibStorage.sol";
import {IAirdrop} from "../src/interfaces/IAirdrop.sol";
import {IDiamondCut, IDiamondErrors} from "../src/interfaces/IDiamond.sol";

// Contract logic tests use this stub. Verifier.t.sol checks the real proof verifier.
contract VerifierStub {
    bytes32 public expected;

    function expect(bytes32 digest) external {
        expected = digest;
    }

    function verify(bytes calldata proof, bytes32[] calldata inputs) external view returns (bool) {
        return keccak256(abi.encode(proof, inputs)) == expected;
    }
}

contract RejectETH {
    receive() external payable {
        revert();
    }
}

contract Replacement {
    function airdropCount() external pure returns (uint256) {
        return 42;
    }
}

contract AirdropTest is Test {
    Diamond diamond;
    AdminFacet admin;
    UserFacet user;
    VerifierStub verifier;
    address alice = address(0xA11CE);
    address relay = address(0xB0B);
    uint256 master = 123;

    function setUp() public {
        verifier = new VerifierStub();
        diamond = new Diamond(
            address(this),
            address(verifier),
            relay,
            LibDeployment.cuts(address(new AdminFacet()), address(new UserFacet()))
        );
        admin = AdminFacet(address(diamond));
        user = UserFacet(address(diamond));
        vm.deal(address(this), 100 ether);
    }

    function tiers() internal view returns (LibStorage.Tier[] memory result) {
        result = new LibStorage.Tier[](1);
        result[0] = LibStorage.Tier("", 1 ether, master);
    }

    function open() internal {
        admin.createAirdrop("Airdrop", 2 ether);
        admin.startClaimPhase(1, 456, tiers());
        admin.fundPool{value: 3 ether}();
    }

    function authorize(uint256 id, uint256 nonce, address recipient) internal returns (uint256 child) {
        child = LibAirdrop.deriveTierKey(master, user.getAirdrop(id).context, nonce);
        bytes32[] memory inputs = new bytes32[](4);
        inputs[0] = bytes32(child);
        inputs[1] = bytes32(nonce);
        inputs[2] = bytes32(user.getAirdrop(id).root);
        inputs[3] = bytes32(uint256(uint160(recipient)));
        verifier.expect(keccak256(abi.encode(hex"1234", inputs)));
    }

    function pay(uint256 id, uint256 nonce) internal {
        uint256 child = authorize(id, nonce, alice);
        vm.prank(relay);
        user.claim(id, hex"1234", child, nonce, alice);
    }

    function testCreationHasNoTiersRootOrDeposit() public {
        admin.createAirdrop("Airdrop", 2 ether);
        assertEq(user.getAirdrop(1).tiers.length, 0);
        assertEq(user.getAirdrop(1).root, 0);
        assertEq(user.poolBalance(), 0);
    }

    function testSuperOwnerWithdrawsAndUpdatesPool() public {
        admin.fundPool{value: 3 ether}();
        admin.withdraw(alice, 1 ether);
        assertEq(alice.balance, 1 ether);
        assertEq(user.poolBalance(), 2 ether);
        vm.expectRevert(IAirdrop.InsufficientPool.selector);
        admin.withdraw(alice, 3 ether);
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.withdraw(address(0), 1);
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.withdraw(alice, 0);
        RejectETH rejecting = new RejectETH();
        vm.expectRevert(IAirdrop.TransferFailed.selector);
        admin.withdraw(address(rejecting), 1 ether);
        assertEq(user.poolBalance(), 2 ether);
    }

    function testDemoAccessCanBeDisabledAndReplaced() public {
        DemoFaucet faucet = new DemoFaucet(address(diamond));
        admin.setDemoFaucet(address(faucet), true);
        vm.prank(alice);
        faucet.requestRole();
        assertTrue(user.isOwner(alice));
        vm.prank(alice);
        admin.createAirdrop("Review", 1 ether);
        admin.setDemoFaucet(address(faucet), false);
        assertFalse(user.isOwner(alice));
        vm.expectRevert(IAirdrop.DemoUnavailable.selector);
        vm.prank(alice);
        faucet.requestRole();
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        admin.setPaused(1, true);
        admin.setDemoFaucet(address(faucet), true);
        assertTrue(user.isOwner(alice));
        DemoFaucet replacement = new DemoFaucet(address(diamond));
        admin.setDemoFaucet(address(replacement), true);
        assertFalse(user.isOwner(alice));
        vm.expectRevert(IAirdrop.DemoUnavailable.selector);
        vm.prank(alice);
        faucet.requestRole();
    }

    function testDemoAdminCannotEscalateOrWithdraw() public {
        DemoFaucet faucet = new DemoFaucet(address(diamond));
        admin.setDemoFaucet(address(faucet), true);
        vm.prank(alice);
        faucet.requestRole();
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        vm.startPrank(alice);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        admin.setOwners(accounts, true);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        admin.withdraw(alice, 1);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        admin.setRelayer(alice);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        admin.setDemoFaucet(address(faucet), false);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        diamond.diamondCut(new IDiamondCut.FacetCut[](0), address(0), "");
        vm.stopPrank();
        admin.setOwners(accounts, true);
        admin.setDemoFaucet(address(faucet), false);
        assertTrue(user.isOwner(alice));
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        admin.withdraw(alice, 1);
    }

    function testOnlyApprovedFaucetCanGrantAndSuperOwnerCannotBeRemoved() public {
        vm.expectRevert(IAirdrop.DemoUnavailable.selector);
        admin.grantDemoOwner(alice);
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.setDemoFaucet(address(0), true);
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.setDemoFaucet(alice, true);
        DemoFaucet wrong = new DemoFaucet(alice);
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.setDemoFaucet(address(wrong), true);
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        admin.setOwners(accounts, true);
        accounts[0] = address(this);
        vm.expectRevert(IAirdrop.LastOwner.selector);
        admin.setOwners(accounts, false);
        assertEq(user.superOwner(), address(this));
    }

    function testOnlyOwnersCanCreateAndManage() public {
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        admin.createAirdrop("A", 1);
        open();
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        admin.setPaused(1, true);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        admin.setRelayer(alice);
    }

    function testAddRemoveOwnersAndKeepLastOwner() public {
        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        admin.setOwners(accounts, true);
        vm.prank(alice);
        admin.createAirdrop("A", 1);
        admin.setOwners(accounts, false);
        assertFalse(user.isOwner(alice));
        accounts[0] = address(this);
        vm.expectRevert(IAirdrop.LastOwner.selector);
        admin.setOwners(accounts, false);
    }

    function testBatchRolesRollbackOnLastOwnerRemoval() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = relay;
        admin.setOwners(accounts, true);
        assertEq(user.owners().length, 3);
        admin.setOwners(accounts, false);
        assertEq(user.owners().length, 1);
    }

    function testPoolFundingAndEndDoNotWithdraw() public {
        open();
        (bool ok,) = address(diamond).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(user.poolBalance(), 4 ether);
        admin.endAirdrop(1);
        assertEq(user.poolBalance(), 4 ether);
    }

    function testOnlyRelayerCanClaim() public {
        open();
        uint256 child = authorize(1, 99, alice);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        user.claim(1, hex"1234", child, 99, alice);
        admin.setRelayer(alice);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, alice);
    }

    function testProofBindsRecipientAndRewardMatchesTier() public {
        open();
        uint256 child = authorize(1, 99, alice);
        vm.expectRevert(IAirdrop.InvalidProof.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, relay);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, alice);
        assertEq(alice.balance, 1 ether);
        assertEq(user.getAirdrop(1).claimed, 1 ether);
        vm.expectRevert(IAirdrop.AlreadyClaimed.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, alice);
    }

    function testNullifiersBelongToTheirAirdrop() public {
        open();
        admin.createAirdrop("B", 2 ether);
        admin.startClaimPhase(2, 789, tiers());
        pay(1, 99);
        assertFalse(user.isClaimed(2, 99));
        pay(2, 99);
        assertTrue(user.isClaimed(2, 99));
    }

    function testAirdropCapCannotDrainPool() public {
        open();
        pay(1, 1);
        pay(1, 2);
        uint256 child = authorize(1, 3, alice);
        vm.expectRevert(IAirdrop.InsufficientBudget.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 3, alice);
        assertEq(user.poolBalance(), 1 ether);
    }

    function testEmptyPoolRejectsWithoutSpendingNullifier() public {
        admin.createAirdrop("A", 2 ether);
        admin.startClaimPhase(1, 456, tiers());
        uint256 child = authorize(1, 99, alice);
        vm.expectRevert(IAirdrop.InsufficientPool.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, alice);
        assertFalse(user.isClaimed(1, 99));
    }

    function testPaymentFailureRollsBack() public {
        open();
        RejectETH recipient = new RejectETH();
        uint256 child = authorize(1, 99, address(recipient));
        vm.expectRevert(IAirdrop.TransferFailed.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, address(recipient));
        assertFalse(user.isClaimed(1, 99));
        assertEq(user.getAirdrop(1).claimed, 0);
    }

    function testRejectBadTiersAndReopening() public {
        admin.createAirdrop("A", 2 ether);
        LibStorage.Tier[] memory values = tiers();
        values[0].masterKey = LibAirdrop.FIELD;
        vm.expectRevert(IAirdrop.InvalidInput.selector);
        admin.startClaimPhase(1, 456, values);
        values[0].masterKey = 0;
        vm.expectRevert(IAirdrop.InvalidTier.selector);
        admin.startClaimPhase(1, 456, values);
        admin.startClaimPhase(1, 456, tiers());
        vm.expectRevert(IAirdrop.WrongPhase.selector);
        admin.startClaimPhase(1, 456, tiers());
    }

    function testPauseEndAndUnknownAirdrop() public {
        vm.expectRevert(IAirdrop.UnknownAirdrop.selector);
        user.getAirdrop(1);
        open();
        uint256 child = authorize(1, 99, alice);
        admin.setPaused(1, true);
        vm.expectRevert(IAirdrop.Paused.selector);
        vm.prank(relay);
        user.claim(1, hex"1234", child, 99, alice);
        admin.endAirdrop(1);
        vm.expectRevert(IAirdrop.WrongPhase.selector);
        admin.setPaused(1, false);
    }

    function testTierVectorsMatchRustAndNode() public pure {
        assertEq(
            LibAirdrop.deriveTierKey(123, 456, 789),
            15515429514514421033763193867582428287094564508703488111330536598833346335655
        );
        assertEq(
            LibAirdrop.deriveTierKey(1, 2, 3),
            2943877217990975181549260018254918226547250642975494786726844296133737096140
        );
    }

    function testFuzzBudget(uint256 budget) public {
        budget = bound(budget, 1, type(uint128).max);
        admin.createAirdrop("A", budget);
        assertEq(user.getAirdrop(1).budget, budget);
    }

    function testDiamondUpgradeAuthorizationAndStorage() public {
        open();
        assertEq(diamond.facets().length, 3);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = UserFacet.airdropCount.selector;
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = IDiamondCut.FacetCut(address(new Replacement()), IDiamondCut.FacetCutAction.Replace, selectors);
        vm.expectRevert(IAirdrop.Unauthorized.selector);
        vm.prank(alice);
        diamond.diamondCut(cuts, address(0), "");
        diamond.diamondCut(cuts, address(0), "");
        assertEq(user.airdropCount(), 42);
        assertEq(user.getAirdrop(1).budget, 2 ether);
        selectors[0] = Diamond.diamondCut.selector;
        vm.expectRevert(IDiamondErrors.InvalidCut.selector);
        diamond.diamondCut(cuts, address(0), "");
    }
}
