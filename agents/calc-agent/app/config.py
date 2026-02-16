from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    agent_name: str = "Calc Agent"
    agent_description: str = "Math utility agent supporting expression evaluation, unit conversion, random number generation, and statistics via A2A and MCP protocols"
    agent_version: str = "1.0.0"
    agent_url: str = ""
    provider_org: str = ""
    provider_url: str = ""
    log_level: str = "info"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://testnet.ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
