from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mongo
    mongodb_uri: str
    mongodb_db: str = "discom"

    # KeeperHub
    keeperhub_api_key: str
    keeperhub_base_url: str = "https://app.keeperhub.com"
    keeperhub_webhook_secret: str
    kh_workflow_coalition_form: str  # alias: compute-coalition-propose
    kh_workflow_activate_and_pool: str  # compute-coalition-activate-and-pool (now activate + create-pool only)
    kh_workflow_set_member_units: str = ""  # compute-coalition-set-member-units (one call per worker)
    kh_workflow_stream_start: str
    kh_workflow_stream_stop: str
    kh_workflow_handle_breach: str

    # Chain
    sepolia_rpc_url: str
    chain_id: int = 16602
    usdc_address: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")
    usdcx_address: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")
    # Coalition is testnet-only. Mainnet deployments omit it and run the
    # economics pipeline with `coalition_enabled=false`, in which case
    # Coalition.propose / activate are skipped and the GDA flow runs without
    # an on-chain stake commitment. Address validation is loosened so the
    # placeholder 0x0...0 is acceptable on mainnet.
    coalition_enabled: bool = True
    coalition_address: str = Field(
        default="0x0000000000000000000000000000000000000000",
        pattern=r"^0x[0-9a-fA-F]{40}$",
    )
    # Forwarders are deployed alongside Superfluid framework on 0G (no canonical addresses).
    cfa_v1_forwarder: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")
    gda_v1_forwarder: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")

    # Orchestrator wallet (payee)
    orchestrator_wallet_address: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")

    # TODO(KH-issue): KeeperHub `web3/write-contract` and `execute_contract_call`
    # both hang server-side on 0G Galileo (chainId 16602) — Cloudflare 524 after
    # 124s, no on-chain tx ever submitted. Sepolia control flows succeed in
    # ~10s. Until KH ships a fix for their 0G handler, the orchestrator submits
    # the five write calls (Coalition.propose / activate, GDA createPool /
    # updateMemberUnits / distributeFlow) directly via web3.py using this key.
    # When KH is restored, swap back to `kh.execute_workflow(...)` calls in
    # economics.py (look for the TODO(KH-issue) markers).
    orchestrator_private_key: str = Field(..., pattern=r"^0x[0-9a-fA-F]{64}$")

    # Faucet wallet — owner of the EIP-3009 mock USDC at usdc_address. When
    # the frontend hits a 402 challenge, the orchestrator mints a small amount
    # of USDC to the user's wallet so the demo flow doesn't require manual
    # funding. Optional: when unset, the faucet falls back to
    # `orchestrator_private_key`. The dummy 0x...01 placeholder is rejected
    # at call time so live deployments can keep that placeholder for the
    # other on-chain calls until a real key is provisioned.
    faucet_private_key: str | None = None

    # x402
    x402_facilitator_url: str = "http://facilitator:4021"
    x402_default_price_per_token_usdc_micro: int = 100

    # Public URL
    public_url: str

    # Inference timing for flow-rate estimation
    seconds_per_token_estimate: float = 0.4

    # 0G chain
    zero_g_chain_rpc: str = "https://evmrpc-testnet.0g.ai"
    zero_g_chain_id: int = 16602

    # PoolINFT contract (deployed on 0G Galileo)
    inft_contract_addr: str | None = None
    inft_oracle_private_key: str | None = None  # dev-only; in prod the key lives in the TEE

    # 0G Storage indexer
    zero_g_storage_indexer_url: str = "https://indexer-storage-testnet-turbo.0g.ai"

    # TEE signer
    tee_signer_key_path: str | None = None      # e.g. /run/keys/tee_signer.key (mounted secret)
    tee_report_type: str = "dev-insecure"       # dev-insecure | sgx-dcap | tdx


@lru_cache
def get_settings() -> Settings:
    return Settings()
