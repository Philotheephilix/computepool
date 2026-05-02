from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    node_id: str
    worker_url: str
    orchestrator_url: str
    owner_api_key: str

    worker_private_key: str = Field(..., pattern=r"^0x[0-9a-fA-F]{64}$")
    sepolia_rpc_url: str = "https://evmrpc-testnet.0g.ai"
    gda_v1_forwarder: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")


@lru_cache
def get_settings() -> Settings:
    return Settings()
