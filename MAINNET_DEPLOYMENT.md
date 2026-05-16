# ComputePool — 0G Mainnet Deployment

- **Chain:** 0G mainnet (chainId 16661)
- **RPC:** https://evmrpc.0g.ai
- **Explorer:** https://chainscan.0g.ai
- **Deployer:** [`0xEb13cc2b696D85584045390672AE05f7eAdeDBc4`](https://chainscan.0g.ai/address/0xEb13cc2b696D85584045390672AE05f7eAdeDBc4)
- **Deployed:** 2026-05-16
- **Spent so far:** ~0.40 OG (started 9.99, ended 9.60)

## Application contracts

| Contract | Address | Notes |
|---|---|---|
| **PoolINFT** (ERC-7857 INFT) | [`0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98`](https://chainscan.0g.ai/address/0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98) | Oracle = deployer (rotate via `setOracle`) |
| **MockUSDC** (EIP-3009, 6 dp) | [`0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4`](https://chainscan.0g.ai/address/0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4) | Owner-mintable; mirrors the testnet mock |
| **USDCx** (Super Token wrap) | [`0x8f0212376639142f2523259c9faBA854dAEbB26a`](https://chainscan.0g.ai/address/0x8f0212376639142f2523259c9faBA854dAEbB26a) | Canonical wrapper of MockUSDC, 18 dp internally |

## Superfluid framework (manually deployed)

The upstream `SuperfluidFrameworkDeployer` couldn't be used directly because the deployer libraries `SuperfluidGDAv1DeployerLibrary` etc. have runtime bytecode that **exceeds EIP-170's 24,576-byte limit** (0G mainnet enforces the standard limit). Each Superfluid component was deployed directly instead, bypassing the bloated wrapper libraries.

| Component | Address |
|---|---|
| **ERC-1820 Registry** (Nick's method) | [`0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24`](https://chainscan.0g.ai/address/0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24) |
| TestGovernance | [`0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B`](https://chainscan.0g.ai/address/0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B) |
| Superfluid Host impl | [`0x6381e07d595D5203Cd2445E176F0D6fd5Bc0b120`](https://chainscan.0g.ai/address/0x6381e07d595D5203Cd2445E176F0D6fd5Bc0b120) |
| Superfluid Host (proxy) | [`0xCd556fD9876f3873d54851DbB5B9db211352f7a7`](https://chainscan.0g.ai/address/0xCd556fD9876f3873d54851DbB5B9db211352f7a7) |
| ConstantFlowAgreementV1 impl | [`0xEE79A2b4345491Ec254561078E771b5964b8A81D`](https://chainscan.0g.ai/address/0xEE79A2b4345491Ec254561078E771b5964b8A81D) |
| GeneralDistributionAgreementV1 impl | [`0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989`](https://chainscan.0g.ai/address/0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989) |
| InstantDistributionAgreementV1 impl | [`0xbcD147DacD40E08D4B0CEB50f35A728C828b464E`](https://chainscan.0g.ai/address/0xbcD147DacD40E08D4B0CEB50f35A728C828b464E) |
| SuperfluidPool beacon | [`0x6985eE145a1ee549718b6F45af849E669f2f9Fd0`](https://chainscan.0g.ai/address/0x6985eE145a1ee549718b6F45af849E669f2f9Fd0) |
| SuperfluidPool impl | [`0x3F03b694564bBF528DB2a7C885fEf1157dc628B2`](https://chainscan.0g.ai/address/0x3F03b694564bBF528DB2a7C885fEf1157dc628B2) |
| PoolAdminNFT | [`0xbf80f325147EA8E0d9283B390eEB37224513B9CA`](https://chainscan.0g.ai/address/0xbf80f325147EA8E0d9283B390eEB37224513B9CA) |
| SuperToken logic | [`0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b`](https://chainscan.0g.ai/address/0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b) |
| SuperTokenFactory impl | [`0x900020e90886Ff87C2F27BF2569cEF2DC775E865`](https://chainscan.0g.ai/address/0x900020e90886Ff87C2F27BF2569cEF2DC775E865) |
| SuperTokenFactory (host-deployed proxy) | [`0xb3C4331aF06429F92557aE9F26f91F27f0256601`](https://chainscan.0g.ai/address/0xb3C4331aF06429F92557aE9F26f91F27f0256601) |
| **CFAv1Forwarder** | [`0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6`](https://chainscan.0g.ai/address/0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6) |
| **GDAv1Forwarder** | [`0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8`](https://chainscan.0g.ai/address/0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8) |

### Linked libraries (deployed earlier, used to link the agreement implementations)

| Library | Address |
|---|---|
| SlotsBitmapLibrary | [`0xd40D5fdB0415607E0ab30489460A502E6CD00F55`](https://chainscan.0g.ai/address/0xd40D5fdB0415607E0ab30489460A502E6CD00F55) |
| SuperfluidPoolDeployerLibrary | [`0x8Bc66AE82f7f9Db88EF074F78d43d004bE86CF0E`](https://chainscan.0g.ai/address/0x8Bc66AE82f7f9Db88EF074F78d43d004bE86CF0E) |

## Application demo transactions

| # | Action | Tx |
|---|---|---|
| 1 | Mint 1,000,000 USDC to deployer | [`0x2f9d2bfd…82ac3042`](https://chainscan.0g.ai/tx/0x2f9d2bfd616d4e816163475ac711a360124b3e71453ff4ddef25cd8282ac3042) |
| 2 | `PoolINFT.mint` tokenId 1 to deployer | [`0xe0a8194e…380dfbe1`](https://chainscan.0g.ai/tx/0xe0a8194eb17b315f40f3e4ff678230584494af88cd8e7022fee0d625380dfbe1) |
| 3 | `USDC.transferWithAuthorization` — 10 USDC | [`0x3fe98fb4…76c2ccf`](https://chainscan.0g.ai/tx/0x3fe98fb4d67f699af22fc76b4a7857704a8c854f49ece3420ec61e2aa76c2ccf) |
| 4 | `PoolINFT.authorizeUsage` | [`0x59124799…6cf8db1abb`](https://chainscan.0g.ai/tx/0x591247994431c1aee4b366597d30a237d4e823d94598f5426e4b616cf8db1abb) |
| 5 | `PoolINFT.cloneWithProof` — tokenId 1 → 2 | [`0x30111fa6…ce97b64142d`](https://chainscan.0g.ai/tx/0x30111fa62c6ceef25008413f511089b2e71128fb721bff883e01ece97b64142d) |
| 6 | `USDC.transfer` — 25 USDC plain ERC-20 | [`0x1fe723fb…79e04cf5da`](https://chainscan.0g.ai/tx/0x1fe723fb564647ba9b1fe6c760f007bd78016fb3be2b8ecd8174d079e04cf5da) |
| 7 | `USDC.transferWithAuthorization` #2 — 5 USDC | [`0x1daa7d49…cda14abcd3d90f`](https://chainscan.0g.ai/tx/0x1daa7d49d62a727301d044793be76df4c848eb78b0938b91d6cca14abcd3d90f) |

## Superfluid demo transactions

| # | Action | Tx |
|---|---|---|
| 1 | ERC-1820 registry deploy (Nick's method) | [`0xfefb2da5…22aa9b0aee8e`](https://chainscan.0g.ai/tx/0xfefb2da535e927b85fe68eb81cb2e4a5827c905f78381a01ef2322aa9b0aee8e) |
| 2 | `Gov.updateContracts(factoryImpl)` — register SuperTokenFactory | [`0x1f1a0fb3…0256d63f78d1a`](https://chainscan.0g.ai/tx/0x1f1a0fb3af0b52358af18a84289e6fcb7cf9140ebe9e89d59c16a76ae5c3c065) |
| 3 | `Factory.initializeCanonicalWrapperSuperTokens` — set sentinel | [`0x37a8aa0d…0a119d86efcbdc024e`](https://chainscan.0g.ai/tx/0x37a8aa0d9ecb238bb70636375a10955e5b2ce2306259c40a119d86efcbdc024e) |
| 4 | `factory.createCanonicalERC20Wrapper(MockUSDC)` → **USDCx** | [`0xb6521ce7…b290cbe0d87bb116757b`](https://chainscan.0g.ai/tx/0xb6521ce7c4e2e27573855c61be359cbbab04074a8f91b290cbe0d87bb116757b) |
| 5 | `USDC.approve(USDCx, 100)` | [`0xdd211157…44e6d2f02627cc811d`](https://chainscan.0g.ai/tx/0xdd21115710caff238bf0411762f8c3d3907299b25268be44e6d2f02627cc811d) |
| 6 | `USDCx.upgrade(100)` — wrap 100 USDC → USDCx | [`0xa732b1a0…b1adcb9f24d1945`](https://chainscan.0g.ai/tx/0xa732b1a0a19d3ad66cfbd97be4783a327ed1b75f2da749d1ab1adcb9f24d1945) |
| 7 | `GDA.createPool(USDCx, admin)` — pool [`0x83Ba2f14EB1febb935919600162A07759E6A4eE8`](https://chainscan.0g.ai/address/0x83Ba2f14EB1febb935919600162A07759E6A4eE8) | [`0xb5d84bd2…6114ce41ead498f`](https://chainscan.0g.ai/tx/0xb5d84bd2c4881cf423cd48a19a90459d21602b4cbc210cf136114ce41ead498f) |
| 8 | `Gov.enableTrustedForwarder(GDAv1Forwarder)` | [`0xa5f1b73c…74fe71939c57a67a9`](https://chainscan.0g.ai/tx/0xa5f1b73c80001c151925559099f18dcd5280ce203fded8a74fe71939c57a67a9) |
| 9 | `Gov.enableTrustedForwarder(CFAv1Forwarder)` | [`0x7212057f…cdedc7b12caaec38c313e`](https://chainscan.0g.ai/tx/0x7212057fb3a0e2983decb7d09e0b9435eb06682919d4dedc7b12caaec38c313e) |

Plus library deploys: SlotsBitmapLibrary, SuperfluidPoolDeployerLibrary, SuperfluidGovDeployerLibrary, SuperfluidHostDeployerLibrary, SuperfluidCFAv1DeployerLibrary, SuperfluidIDAv1DeployerLibrary. Component deploys: TestGovernance, Host impl, Host proxy, CFA impl, GDA impl, IDA impl, Pool impl (3 versions during debugging), beacon, PoolAdminNFT, SuperToken logic, SuperTokenFactory impl. All `forge`-style addresses logged in `.mainnet_state.json` and visible on Chainscan.

## What works on mainnet

- **PoolINFT**: mint, transferWithProof, cloneWithProof, authorizeUsage — all proven by demo txs.
- **MockUSDC**: mint, transfer, EIP-3009 `transferWithAuthorization` — works end-to-end (x402 settlement on mainnet is functional).
- **Superfluid token wrap**: USDC ↔ USDCx via the canonical wrapper. Upgrade works (totalSupply read confirms 100 USDCx minted from 100 USDC).
- **GDA pool creation**: a Superfluid pool exists on-chain at `0x83Ba2f14EB1febb935919600162A07759E6A4eE8`, owned by the deployer, backed by USDCx.

## Known gap — agreement-class registration

When wiring CFA / GDA / IDA into the host via `gov.registerAgreementClass`, I passed each agreement's UUPS **proxy** instead of its implementation. The host's `registerAgreementClass` deploys its own UUPSProxy around whatever you give it — so passing my proxies created a **two-proxy chain** that shares the same `_IMPLEMENTATION_SLOT` storage slot, causing infinite recursion when the host tries to forward calls through it.

**Practical effect.** Calling `GDAv1Forwarder.updateMemberUnits` / `distributeFlow` reverts, because the forwarder fetches `_gda = host.getAgreementClass(GDA_TYPE)` at deploy time (= the host's wrapping proxy at `0x52dd…`), and routes calls through that broken proxy. Calling `GeneralDistributionAgreementV1` directly on my underlying proxy (`0x25b230f7…`) works — that's how `createPool` succeeded above.

`gov.updateContracts(agreementImpls)` would normally fix this, but the path it takes (`proxy.updateCode`) also goes through the same broken proxy.

**Fix path for the next session.** Rebuild the framework but call `gov.registerAgreementClass(IMPL_ADDRESS)` directly (not the proxy address). The host then deploys one clean UUPSProxy per agreement and there's no double-chain. Components that need replacing are CFA / GDA / IDA proxies + the pool impl that points at the GDA address. Estimated cost: ~0.05 OG. Everything else stays.

**Workaround for the orchestrator on mainnet today.** Set `GDA_V1_FORWARDER` in `.env.mainnet` to the deployed forwarder at `0xA1cee3ba…E8eb8` for compatibility, but the orchestrator's economics pipeline (`createPool` / `updateMemberUnits` / `distributeFlow`) won't actually settle real streams until the agreement re-registration is fixed. The `coalition_enabled=false` flag and the x402-only payment path in `orchestrator/economics.py` already keep the orchestrator usable on mainnet without streaming.

## Code changes shipped with this deployment

| File | What |
|---|---|
| `contracts/src/MockUSDC.sol` | New: EIP-3009 mock matching the testnet ABI |
| `scripts/deploy_mainnet.py` | New: PoolINFT + MockUSDC + demo driver (resume-safe state in `.mainnet_state.json`) |
| `scripts/more_demo_txs.py` | New: extra demo activity (authorize, clone, ERC-20 transfer, second EIP-3009 settle) |
| `scripts/deploy_superfluid_mainnet.py` | New: first attempt via SuperfluidFrameworkDeployer; halted at GDA library (>24KB) |
| `scripts/deploy_superfluid_manual.py` | New: manual component-by-component Superfluid deploy that bypassed the size-blocked libraries |
| `scripts/finish_superfluid_demo.py` | New: ERC-1820 deploy + factory registration + USDCx + Superfluid demo flow |
| `orchestrator/settings.py` | `coalition_enabled` feature flag; `coalition_address` now optional |
| `orchestrator/economics.py` | Coalition writes skipped when `coalition_enabled=false`; GDA flow runs without Coalition |
| `.env.mainnet` | Generated; local-only |
| `.mainnet_state.json` | Generated; resume cursor + full address book |

## How to reproduce

```sh
cd computepool
source .venv/bin/activate
python scripts/deploy_mainnet.py --phase all              # PoolINFT + MockUSDC + base demo
python scripts/more_demo_txs.py                            # extra app-layer txs
python scripts/deploy_superfluid_manual.py                 # Superfluid framework (manual)
python scripts/finish_superfluid_demo.py                   # ERC-1820 + USDCx + GDA demo
```

To run the orchestrator against mainnet, fill in the operator-key TODO stubs in `.env.mainnet` (orchestrator wallet, faucet key, worker keys, demo-payer) and `docker compose --env-file .env.mainnet up -d`. The `GDA_V1_FORWARDER` is wired but streaming reverts until the agreement-registration gap above is fixed.
