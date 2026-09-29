// SPDX-License-Identifier: MIT
// test/Verifier.t.sol
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {HonkVerifier} from "../src/verifier/Verifier.sol";

contract VerifierTest is Test {
    HonkVerifier verifier;
    bytes proof;
    bytes32[] inputs;

    function setUp() public {
        verifier = new HonkVerifier();
        string memory fixture = vm.readFile("test/fixtures/proof.json");
        proof = vm.parseJsonBytes(fixture, ".proof");
        inputs = vm.parseJsonBytes32Array(fixture, ".publicInputs");
    }

    function testRealNoirProof() public view {
        assertEq(inputs.length, 4);
        assertTrue(verifier.verify(proof, inputs));
    }

    function testChangingAnyPublicInputRejectsTheProof() public {
        for (uint256 i; i < inputs.length; ++i) {
            bytes32 previous = inputs[i];
            inputs[i] = bytes32(uint256(previous) + 1);
            vm.expectRevert();
            verifier.verify(proof, inputs);
            inputs[i] = previous;
        }
    }

    function testDamagedProofIsRejected() public {
        proof[0] = bytes1(uint8(proof[0]) ^ 1);
        vm.expectRevert();
        verifier.verify(proof, inputs);
    }
}
