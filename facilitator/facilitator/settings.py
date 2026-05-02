from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    sepolia_rpc_url: str
    relayer_private_key: str = Field(..., pattern=r"^0x[0-9a-fA-F]{64}$")
    usdc_address: str = Field(..., pattern=r"^0x[0-9a-fA-F]{40}$")

    chain_id: int = 16602
    usdc_decimals: int = 6
    confirmations: int = 1
    listen_port: int = 4021

    @field_validator("relayer_private_key")
    @classmethod
    def _reject_zero_key(cls, v: str) -> str:
        if int(v, 16) == 0:
            raise ValueError("relayer_private_key cannot be the zero key — fund a relayer wallet and set RELAYER_PRIVATE_KEY")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
