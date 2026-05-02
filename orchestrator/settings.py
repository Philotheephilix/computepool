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
    coalition_address: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")
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

    # x402
    x402_facilitator_url: str = "http://facilitator:4021"
    x402_default_price_per_token_usdc_micro: int = 100

    # Public URL
    public_url: str

    # Inference timing for flow-rate estimation
    seconds_per_token_estimate: float = 0.4


@lru_cache
def get_settings() -> Settings:
    return Settings()
