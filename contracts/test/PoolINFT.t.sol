// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolINFT} from "../src/PoolINFT.sol";

contract PoolINFTTest is Test {
    PoolINFT inft;
    address admin = address(0xA11CE);
    address oracle;
    uint256 oraclePk = 0xB0B;
    address alice = address(0xA1);
    address bob   = address(0xB2);

    function setUp() public {
        oracle = vm.addr(oraclePk);
        vm.prank(admin);
        inft = new PoolINFT(oracle);
    }

    function test_Mint_StoresAndEmits() public {
        bytes32 hash = keccak256("plaintext");
        vm.prank(admin);
        uint256 id = inft.mint(alice, hash, "0g://abcd", hex"deadbeef");
        assertEq(id, 1);
        assertEq(inft.ownerOf(id), alice);
        (bytes32 h, string memory uri, bytes memory sk) = inft.pools(id);
        assertEq(h, hash);
        assertEq(uri, "0g://abcd");
        assertEq(sk, hex"deadbeef");
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(alice);
        vm.expectRevert();
        inft.mint(alice, bytes32(0), "x", hex"00");
    }

    function test_AuthorizeUsage_OwnerThenUserUntilExpiry() public {
        vm.prank(admin);
        uint256 id = inft.mint(alice, bytes32(0), "x", hex"00");
        assertTrue(inft.isAuthorized(id, alice));
        assertFalse(inft.isAuthorized(id, bob));

        vm.prank(alice);
        inft.authorizeUsage(id, bob, block.timestamp + 1 hours);
        assertTrue(inft.isAuthorized(id, bob));

        vm.warp(block.timestamp + 2 hours);
        assertFalse(inft.isAuthorized(id, bob));
    }
}
