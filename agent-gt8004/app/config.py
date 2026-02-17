from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    google_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"
    agent_name: str = "GT8004 Support Agent"
    agent_description: str = "Official GT8004 platform support agent — helps with SDK integration, registration, troubleshooting, and platform usage"
    agent_version: str = "1.0.0"
    agent_url: str = ""
    provider_org: str = "GT8004"
    provider_url: str = "https://gt8004.xyz"
    log_level: str = "info"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
