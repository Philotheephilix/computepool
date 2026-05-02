// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PoolINFT} from "../src/PoolINFT.sol";

/// @notice Deploys PoolINFT to the configured network.
/// Usage:
///   forge script script/DeployPoolINFT.s.sol \
///     --rpc-url zerog_galileo --broadcast --verify
contract DeployPoolINFT is Script {
    function run() external returns (PoolINFT inft) {
        address oracle = vm.envAddress("TEE_ORACLE_ADDRESS");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        inft = new PoolINFT(oracle);
        vm.stopBroadcast();

        console.log("PoolINFT deployed at:", address(inft));
        console.log("Oracle (TEE signer):", oracle);
    }
}
