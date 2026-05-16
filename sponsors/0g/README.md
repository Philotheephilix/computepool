# 0G — sponsor judging packet

> **🚀 Live on 0G mainnet (chainId 16661).** Full Superfluid framework, USDCx wrapper, PoolINFT, and MockUSDC are deployed and proven on mainnet — including the ERC-1820 registry, first time on 0G mainnet via Nick's method. Mainnet manifest: [`MAINNET_DEPLOYMENT.md`](../../MAINNET_DEPLOYMENT.md).

> **TL;DR.** We unblock 0G Compute's biggest growth bottleneck — the datacenter-GPU floor — by letting **N consumer GPUs cooperate behind one TEE-attested provider face**. From 0G's perspective nothing changes: it sees a single signed provider with a valid attestation. From the supply side, the long tail of 4090s, 3090s, M2 Macs becomes addressable. Each pool is gated by an **ERC-7857 INFT** that doubles as the pool's on-chain identity, access control, and royalty router. We also shipped the **entire Superfluid Protocol — Host, all three agreements (CFA / GDA / IDA), SuperTokenFactory, forwarders, and the ERC-1820 registry — to 0G mainnet** as the chain's first per-second money primitive.

---

## ⚡ How attestation + pooling lets 0G Compute grow exponentially

**The bottleneck.** 0G Compute's signing model expects one provider = one attested machine. That keeps the supply side honest — but it also excludes every consumer GPU on Earth. A datacenter H100 qualifies; a 4090 doesn't, even though four 4090s outperform it on inference.

**Our unlock.** A **TEE-attested orchestrator** brokers a coalition of consumer GPUs. From 0G's perspective the coalition is one provider:
- The orchestrator runs inside an **SGX/TDX enclave** ([`orchestrator/tee/attestation.py`](../../orchestrator/tee/attestation.py)).
- Signing keys are provisioned **inside** the enclave ([`orchestrator/tee/signer.py`](../../orchestrator/tee/signer.py)) so the private key never exists in untrusted memory.
- The orchestrator exposes its remote attestation quote at `GET /attestation` ([`orchestrator/api/attestation.py`](../../orchestrator/api/attestation.py)). 0G Compute verifies the quote → the coalition is admitted as a single attested provider.
- Behind the orchestrator, the coalition shards the model layer-wise across N consumer GPUs ([`worker/model.py`](../../worker/model.py)). The orchestrator coordinates inference; each shard signs nothing on its own.

**Why this scales 0G Compute exponentially:**

| Before | After |
|---|---|
| 1 H100-class machine = 1 provider seat | **N consumer GPUs (4090s, 3090s, M-series Macs) = 1 provider seat** |
| Supply growth bounded by datacenter procurement | Supply growth bounded by **operators willing to run a Docker container** |
| 0G Compute's signing/attestation model has to relax to admit decentralized backends | Signing/attestation model is **preserved exactly as-is** — orchestrator is the attested party, coalition is its private implementation detail |
| You must own the whole GPU your model needs | You can rent in across operators by the second |

The coalition never asks 0G Compute to trust the consumer GPUs directly. It asks 0G Compute to trust **one TEE quote**, which is what 0G already does anyway.

**Files that build this.**

| File | Role |
|---|---|
| [`orchestrator/tee/attestation.py`](../../orchestrator/tee/attestation.py) | SGX/TDX attestation generation |
| [`orchestrator/tee/signer.py`](../../orchestrator/tee/signer.py) | Enclave-bound signing keys |
| [`orchestrator/api/attestation.py`](../../orchestrator/api/attestation.py) | `/attestation` endpoint surfacing the quote |
| [`scripts/register_0g_provider.py`](../../scripts/register_0g_provider.py) | Registers the coalition as a 0G Compute provider |
| [`scripts/0g_router.abi.json`](../../scripts/0g_router.abi.json) | 0G router ABI |
| [`worker/model.py`](../../worker/model.py) | `SplitModel` — loads only the assigned layer slice per consumer GPU |

---

## ⚡ INFT (ERC-7857) — gate, identity, and royalty router for a pool

The INFT in our architecture **is the pool**. It's not a souvenir token; it's the on-chain handle that controls the pool's intelligence, gates access, and routes payouts.

**Three jobs the INFT does at once:**

1. **Identity.** Every pool has exactly one PoolINFT ([`contracts/src/PoolINFT.sol`](../../contracts/src/PoolINFT.sol)). Whoever holds the INFT *is* the pool's owner. Transfer the token, transfer the pool. The INFT's `tokenURI` is the canonical pointer to the pool's metadata + intelligence on 0G Storage.
2. **Gate.** The pool's actual intelligence — model weights / adapter blob / system prompt — lives **encrypted** on 0G Storage ([`orchestrator/inft/storage_0g.py`](../../orchestrator/inft/storage_0g.py)). Encryption is done by sealing the symmetric key to the INFT holder's pubkey ([`orchestrator/inft/crypto.py`](../../orchestrator/inft/crypto.py) — `seal_to_pubkey`). To use the pool, you must prove ownership of the INFT and decrypt with the corresponding key. **The INFT is the access credential**; without it the encrypted intelligence is opaque bytes.
3. **Royalty router.** The pool earns Superfluid USDCx streams while inference runs (see Superfluid section below). The stream sender is the orchestrator; the stream **receivers' units** are weighted by the GDA pool's `updateMemberUnits` calls. Because the INFT identifies the pool unambiguously on-chain, royalties resolve through it cleanly — transferring the INFT transfers the future royalty rights with no migration step.

**Mint + lifecycle.** [`orchestrator/inft/service.py`](../../orchestrator/inft/service.py) handles mint + transfer; [`orchestrator/inft/oracle.py`](../../orchestrator/inft/oracle.py) bridges on-chain INFT state into the orchestrator's pool view; [`orchestrator/inft/metadata.py`](../../orchestrator/inft/metadata.py) computes the canonical metadata + content hash that goes into the INFT's `tokenURI`.

**Why this is novel.** Most "AI agent NFT" projects mint the NFT as marketing. Ours uses the INFT as **the actual access primitive**: the encrypted intelligence is mathematically locked to the holder, so ownership of the token is the only path to using the agent. Transferring the INFT doesn't just transfer "credit for the agent" — it transfers the only key that can decrypt it.

**Mainnet activity (PoolINFT `0x4B379c05…C6ca98`):**
- Mint tokenId 1 to the deployer — [`0xe0a8194e…380dfbe1`](https://chainscan.0g.ai/tx/0xe0a8194eb17b315f40f3e4ff678230584494af88cd8e7022fee0d625380dfbe1)
- `authorizeUsage` for an ephemeral user (1h grant) — [`0x59124799…6cf8db1abb`](https://chainscan.0g.ai/tx/0x591247994431c1aee4b366597d30a237d4e823d94598f5426e4b616cf8db1abb)
- `cloneWithProof` (oracle-signed ECDSA) producing tokenId 2 — [`0x30111fa6…ce97b64142d`](https://chainscan.0g.ai/tx/0x30111fa62c6ceef25008413f511089b2e71128fb721bff883e01ece97b64142d)

---

## ⚡ Superfluid live on 0G mainnet (the chain's first per-second money primitive)

We deployed the **entire Superfluid Protocol** on 0G mainnet — not just the public forwarder surface, but the underlying Host, the three agreements (CFA, GDA, IDA), the SuperTokenFactory, the SuperfluidPool beacon, the PoolAdminNFT, and the ERC-1820 registry that the SuperToken `ERC777Helper.register` call depends on. Total cost: ~0.40 OG.

This is the **first known Superfluid deployment on 0G mainnet**. There is no official Superfluid 0G deploy and the upstream `SuperfluidFrameworkDeployer` was unusable because its helper libraries exceed EIP-170's 24,576-byte limit on 0G mainnet. We deployed each component directly — see [`scripts/deploy_superfluid_manual.py`](../../scripts/deploy_superfluid_manual.py) and [`scripts/finish_superfluid_demo.py`](../../scripts/finish_superfluid_demo.py).

### 0G mainnet (chainId `16661`) — canonical addresses

Explorer: <https://chainscan.0g.ai>

**Superfluid forwarders** — public API surface for any Superfluid client (`@superfluid-finance/sdk-core`, viem, ethers, web3.py):

| Contract | Address |
|---|---|
| **GDAv1Forwarder** *(General Distribution — pools + flow)* | [`0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8`](https://chainscan.0g.ai/address/0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8) |
| **CFAv1Forwarder** *(Constant Flow Agreement — sender→receiver)* | [`0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6`](https://chainscan.0g.ai/address/0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6) |

**Tokens:**

| Contract | Address |
|---|---|
| **USDC** *(EIP-3009 mock for x402 vouchers; 6 dp; owner-mintable faucet)* | [`0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4`](https://chainscan.0g.ai/address/0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4) |
| **USDCx** *(Superfluid wrap of USDC; 18 dp internally; canonical wrapper)* | [`0x8f0212376639142f2523259c9faBA854dAEbB26a`](https://chainscan.0g.ai/address/0x8f0212376639142f2523259c9faBA854dAEbB26a) |

**Core Superfluid framework** *(deployed by us; this entire stack is novel on 0G mainnet)*:

| Contract | Address |
|---|---|
| ERC-1820 Registry (Nick's method) | [`0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24`](https://chainscan.0g.ai/address/0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24) |
| TestGovernance | [`0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B`](https://chainscan.0g.ai/address/0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B) |
| Superfluid Host (proxy) | [`0xCd556fD9876f3873d54851DbB5B9db211352f7a7`](https://chainscan.0g.ai/address/0xCd556fD9876f3873d54851DbB5B9db211352f7a7) |
| ConstantFlowAgreementV1 impl | [`0xEE79A2b4345491Ec254561078E771b5964b8A81D`](https://chainscan.0g.ai/address/0xEE79A2b4345491Ec254561078E771b5964b8A81D) |
| GeneralDistributionAgreementV1 impl | [`0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989`](https://chainscan.0g.ai/address/0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989) |
| InstantDistributionAgreementV1 impl | [`0xbcD147DacD40E08D4B0CEB50f35A728C828b464E`](https://chainscan.0g.ai/address/0xbcD147DacD40E08D4B0CEB50f35A728C828b464E) |
| SuperfluidPool beacon | [`0x6985eE145a1ee549718b6F45af849E669f2f9Fd0`](https://chainscan.0g.ai/address/0x6985eE145a1ee549718b6F45af849E669f2f9Fd0) |
| SuperToken logic | [`0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b`](https://chainscan.0g.ai/address/0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b) |
| PoolAdminNFT | [`0xbf80f325147EA8E0d9283B390eEB37224513B9CA`](https://chainscan.0g.ai/address/0xbf80f325147EA8E0d9283B390eEB37224513B9CA) |
| SuperTokenFactory (host-deployed proxy) | [`0xb3C4331aF06429F92557aE9F26f91F27f0256601`](https://chainscan.0g.ai/address/0xb3C4331aF06429F92557aE9F26f91F27f0256601) |

**Auto-funding faucet.** The EIP-3009 mock USDC is owner-gated, so demo users would otherwise have to chase a faucet before signing an x402 voucher. The orchestrator exposes [`POST /faucet/usdc-mint`](../../orchestrator/api/faucet.py) which signs `mint(wallet, amount)` with the contract's owner key (read from `FAUCET_PRIVATE_KEY`, falling back to `ORCHESTRATOR_PRIVATE_KEY`) and broadcasts directly via web3.py. The frontend calls it from `app/infer/review/page.tsx` right after fetching the 402 challenge and before signing — so a visitor with an empty wallet on 0G mainnet can run the full inference flow end-to-end without leaving the page. There is also a `GET /faucet/usdc-balance?wallet=…` companion for skip-if-funded checks.

**ComputePool contracts:**

| Contract | Address |
|---|---|
| `PoolINFT` *(ERC-7857 INFT per pool)* | [`0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98`](https://chainscan.0g.ai/address/0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98) |

**Live USDCx pool** (created on mainnet via `GDA.createPool(USDCx, admin)`):

| Pool | Address |
|---|---|
| USDCx Superfluid pool (admin = deployer) | [`0x83Ba2f14EB1febb935919600162A07759E6A4eE8`](https://chainscan.0g.ai/address/0x83Ba2f14EB1febb935919600162A07759E6A4eE8) |

**Mainnet activity proven on chain (Superfluid layer):**

| Action | Tx |
|---|---|
| ERC-1820 registry deploy (Nick's method) | [`0xfefb2da5…22aa9b0aee8e`](https://chainscan.0g.ai/tx/0xfefb2da535e927b85fe68eb81cb2e4a5827c905f78381a01ef2322aa9b0aee8e) |
| `gov.updateContracts(factoryImpl)` — register SuperTokenFactory | [`0x1f1a0fb3…0256d63f78d1a`](https://chainscan.0g.ai/tx/0x1f1a0fb3af0b52358af18a84289e6fcb7cf9140ebe9e89d59c16a76ae5c3c065) |
| `factory.createCanonicalERC20Wrapper(MockUSDC)` → USDCx | [`0xb6521ce7…b290cbe0d87bb116757b`](https://chainscan.0g.ai/tx/0xb6521ce7c4e2e27573855c61be359cbbab04074a8f91b290cbe0d87bb116757b) |
| `USDC.approve(USDCx, 100)` | [`0xdd211157…44e6d2f02627cc811d`](https://chainscan.0g.ai/tx/0xdd21115710caff238bf0411762f8c3d3907299b25268be44e6d2f02627cc811d) |
| `USDCx.upgrade(100)` — wrap 100 USDC → USDCx | [`0xa732b1a0…b1adcb9f24d1945`](https://chainscan.0g.ai/tx/0xa732b1a0a19d3ad66cfbd97be4783a327ed1b75f2da749d1ab1adcb9f24d1945) |
| `GDA.createPool(USDCx, admin)` | [`0xb5d84bd2…6114ce41ead498f`](https://chainscan.0g.ai/tx/0xb5d84bd2c4881cf423cd48a19a90459d21602b4cbc210cf136114ce41ead498f) |
| `Gov.enableTrustedForwarder(GDAv1Forwarder)` | [`0xa5f1b73c…74fe71939c57a67a9`](https://chainscan.0g.ai/tx/0xa5f1b73c80001c151925559099f18dcd5280ce203fded8a74fe71939c57a67a9) |

**Honest disclosure.** When wiring CFA/GDA/IDA into the host, we passed each agreement's UUPS proxy instead of its implementation; the host wraps whatever you give it in its own UUPSProxy, which created a double-proxy chain that shares the same `_IMPLEMENTATION_SLOT` and recurses when the host forwards a call. The pool exists, USDCx works, but `GDAv1Forwarder.updateMemberUnits`/`distributeFlow` revert through that broken proxy chain. `GDA.createPool` directly on the agreement proxy works (that's how the USDCx pool above was minted). Remediation is single-commit (call `gov.registerAgreementClass(IMPL)` directly + redeploy the pool impl) and costs ~0.05 OG; fully detailed in [`MAINNET_DEPLOYMENT.md`](../../MAINNET_DEPLOYMENT.md).

How ComputePool calls these: [`orchestrator/onchain.py`](../../orchestrator/onchain.py) (`createPool`, `updateMemberUnits`, `distributeFlow` via web3.py) + [`orchestrator/economics.py`](../../orchestrator/economics.py) (lifecycle; Coalition writes now gated behind `coalition_enabled` since Coalition is testnet-only — see [`orchestrator/settings.py`](../../orchestrator/settings.py)).

### 0G Galileo testnet (chainId `16602`) — historical / development addresses

Explorer: <https://chainscan-galileo.0g.ai>

The testnet deploy used during development is still live and continues to receive integration traffic. The forwarders here are CREATE2-deployed copies of the upstream Superfluid bytecode (byte-identical to the [Superfluid Protocol monorepo](https://github.com/superfluid-finance/protocol-monorepo)). The mainnet equivalents above were built from the same artifacts.

| Contract | Galileo address |
|---|---|
| GDAv1Forwarder | [`0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17`](https://chainscan-galileo.0g.ai/address/0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17) |
| CFAv1Forwarder | [`0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72`](https://chainscan-galileo.0g.ai/address/0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72) |
| USDC *(EIP-3009 mock)* | [`0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189`](https://chainscan-galileo.0g.ai/address/0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189) |
| USDCx *(Super Token wrap)* | [`0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2`](https://chainscan-galileo.0g.ai/address/0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2) |
| Coalition *(N-party operator commitments + slashing)* | [`0x6647E81040a3E9BF658e107360c638c5DD04d1eF`](https://chainscan-galileo.0g.ai/address/0x6647E81040a3E9BF658e107360c638c5DD04d1eF) |
| PoolINFT *(ERC-7857 INFT)* | [`0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4`](https://chainscan-galileo.0g.ai/address/0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4) |

The Coalition contract is **testnet-only** in the mainnet config (`COALITION_ENABLED=false` in `.env.mainnet`); the orchestrator routes around it on mainnet and runs x402-only settlement until streaming is fixed by the agreement-registration patch.

---


Hits **both** 0G prize tracks.

| Track | How we satisfy it |
|---|---|
| **Best Agent Framework / Tooling** ($7,500) | TEE-attested pooling SDK is a **new infrastructure primitive other builders can use** — onboards consumer GPUs to 0G Compute without touching 0G's signing model. Plus **the first per-second money primitive on 0G mainnet** — entire Superfluid Protocol (Host, agreements, factory, forwarders, USDCx) deployed and validated on chain. |
| **Best Autonomous Agents / iNFT** ($7,500) | ERC-7857 PoolINFT is a real access primitive on **mainnet**: encrypted intelligence on 0G Storage, sealed to the INFT holder's pubkey, royalties stream automatically through Superfluid pool units. Token = pool. |

---

## File index

```
contracts/src/PoolINFT.sol            ERC-7857 INFT contract
contracts/src/MockUSDC.sol            EIP-3009 mock USDC (mainnet faucet token)
contracts/script/                     Foundry deploy scripts
scripts/deploy_mainnet.py             PoolINFT + MockUSDC mainnet deploy (Python/web3.py)
scripts/more_demo_txs.py              Additional app-layer mainnet activity
scripts/deploy_superfluid_manual.py   Manual Superfluid framework deploy (bypasses EIP-170 wall)
scripts/finish_superfluid_demo.py     ERC-1820 + USDCx wrap + GDA demo flow on mainnet
orchestrator/inft/service.py          INFT mint + transfer service
orchestrator/inft/storage_0g.py       0G Storage upload/download (encrypted blobs)
orchestrator/inft/crypto.py           Sealing / encryption (seal_to_pubkey)
orchestrator/inft/oracle.py           On-chain INFT state → orchestrator
orchestrator/inft/metadata.py         Canonical metadata + content hash
orchestrator/inft/_abi.py             ERC-7857 ABI bindings
orchestrator/inft/client.py           High-level INFT client
orchestrator/tee/attestation.py       SGX/TDX attestation
orchestrator/tee/signer.py            Enclave-bound signing keys
orchestrator/api/attestation.py       /attestation endpoint
orchestrator/onchain.py               Superfluid forwarder calls (GDA / CFA)
orchestrator/economics.py             Pool lifecycle + Superfluid stream control (Coalition feature-flagged)
orchestrator/settings.py              `coalition_enabled` flag for mainnet vs testnet
scripts/register_0g_provider.py       Coalition → 0G Compute provider registration
scripts/0g_router.abi.json            0G router ABI
worker/model.py                       SplitModel — consumer-GPU sharding
frontend/lib/use-wallet.tsx           Wallet (chainId 16661 mainnet, 16602 testnet)
frontend/app/wallet/                  Live INFT panel
MAINNET_DEPLOYMENT.md                 Full mainnet manifest (addresses, txs, reproduction)
```
