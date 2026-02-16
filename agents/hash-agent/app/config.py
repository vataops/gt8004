from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    agent_name: str = "Hash Agent"
    agent_description: str = "Cryptographic utility agent — hashing, encoding, checksumming, UUID generation via A2A and MCP"
    agent_version: str = "1.0.0"
    agent_url: str = ""
    log_level: str = "info"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://testnet.ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
