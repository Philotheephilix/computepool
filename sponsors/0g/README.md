# 0G — sponsor judging packet

> **TL;DR.** We unblock 0G Compute's biggest growth bottleneck — the datacenter-GPU floor — by letting **N consumer GPUs cooperate behind one TEE-attested provider face**. From 0G's perspective nothing changes: it sees a single signed provider with a valid attestation. From the supply side, the long tail of 4090s, 3090s, M2 Macs becomes addressable. Each pool is gated by an **ERC-7857 INFT** that doubles as the pool's on-chain identity, access control, and royalty router. We also shipped Superfluid to 0G Galileo as the chain's first per-second money primitive.

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

**Live integration:** commit `c3f9027` — *"feat(inft): live INFT integration on 0G Galileo + redesigned wallet card."*

---

## ⚡ Superfluid live on 0G Galileo (the chain's first per-second money primitive)

We CREATE2-deployed and source-verified the Superfluid forwarders on 0G Galileo testnet. They're public — anyone in the 0G ecosystem can call them.

### Deployed contract addresses on 0G Galileo (chainId `16602`)

Explorer: <https://chainscan-galileo.0g.ai>

**Superfluid forwarders** — public API surface:

| Contract | Address |
|---|---|
| **GDAv1Forwarder** *(General Distribution — pools + flow)* | [`0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17`](https://chainscan-galileo.0g.ai/address/0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17) |
| **CFAv1Forwarder** *(Constant Flow Agreement — sender→receiver)* | [`0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72`](https://chainscan-galileo.0g.ai/address/0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72) |

**Tokens:**

| Contract | Address |
|---|---|
| **USDC** *(EIP-3009 mock for x402 vouchers)* | [`0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189`](https://chainscan-galileo.0g.ai/address/0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189) |
| **USDCx** *(Super Token wrap of USDC)* | [`0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2`](https://chainscan-galileo.0g.ai/address/0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2) |

**Auto-funding faucet.** The EIP-3009 mock USDC is owner-gated, so demo users would otherwise have to chase a faucet before signing an x402 voucher. The orchestrator exposes [`POST /faucet/usdc-mint`](../../orchestrator/api/faucet.py) which signs `mint(wallet, amount)` with the contract's owner key (read from `FAUCET_PRIVATE_KEY`, falling back to `ORCHESTRATOR_PRIVATE_KEY`) and broadcasts directly via web3.py. The frontend calls it from `app/infer/review/page.tsx` right after fetching the 402 challenge and before signing — so a Vercel visitor with an empty wallet on 0G Galileo can run the full inference flow end-to-end without leaving the page. There is also a `GET /faucet/usdc-balance?wallet=…` companion for skip-if-funded checks.

**ComputePool contracts:**

| Contract | Address |
|---|---|
| `Coalition` *(N-party operator commitments + slashing)* | [`0x6647E81040a3E9BF658e107360c638c5DD04d1eF`](https://chainscan-galileo.0g.ai/address/0x6647E81040a3E9BF658e107360c638c5DD04d1eF) |
| `PoolINFT` *(ERC-7857 INFT per pool)* | [`0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4`](https://chainscan-galileo.0g.ai/address/0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4) |

**Honest disclosure.** The forwarder addresses above are **not** the canonical Superfluid CREATE2 addresses (the canonical deployer's nonce isn't available on a fresh chain). Bytecode + ABI are byte-identical to the upstream Superfluid Protocol monorepo — <https://github.com/superfluid-finance/protocol-monorepo> — so any standard Superfluid client (`@superfluid-finance/sdk-core`, viem, ethers) works unmodified; just point at these addresses on 0G Galileo.

How ComputePool calls these: [`orchestrator/onchain.py`](../../orchestrator/onchain.py) (`createPool`, `updateMemberUnits`, `distributeFlow` via web3.py) + [`orchestrator/economics.py`](../../orchestrator/economics.py) (lifecycle).

---

## Track qualification

Hits **both** 0G prize tracks.

| Track | How we satisfy it |
|---|---|
| **Best Agent Framework / Tooling** ($7,500) | TEE-attested pooling SDK is a **new infrastructure primitive other builders can use** — onboards consumer GPUs to 0G Compute without touching 0G's signing model. Plus first per-second money primitive on 0G via Superfluid. |
| **Best Autonomous Agents / iNFT** ($7,500) | ERC-7857 PoolINFT is a real access primitive: encrypted intelligence on 0G Storage, sealed to the INFT holder's pubkey, royalties stream automatically through Superfluid pool units. Token = pool. |

---

## File index

```
contracts/src/PoolINFT.sol            ERC-7857 INFT contract
contracts/script/                     Foundry deploy scripts (CREATE2)
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
orchestrator/economics.py             Pool lifecycle + Superfluid stream control
scripts/register_0g_provider.py       Coalition → 0G Compute provider registration
scripts/0g_router.abi.json            0G router ABI
worker/model.py                       SplitModel — consumer-GPU sharding
frontend/lib/use-wallet.tsx           Galileo-only wallet (chainId 16602)
frontend/app/wallet/                  Live INFT panel
```
