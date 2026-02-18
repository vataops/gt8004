from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    agent_name: str = "GT8004 Platform Agent"
    agent_description: str = (
        "Self-service agent for the GT8004 platform — "
        "register your AI agent via ERC-8004, manage API keys, "
        "and query analytics (requests, revenue, customers, performance)"
    )
    agent_version: str = "1.0.0"
    agent_url: str = ""
    log_level: str = "info"

    # LLM (for A2A)
    google_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"

    # x402 Payment
    x402_pay_to: str = ""
    x402_network: str = "base"
    x402_price: str = "0.01"

    # A2A internal communication
    a2a_base_url: str = ""
    internal_api_key: str = ""

    # Agent card
    provider_org: str = ""
    provider_url: str = ""

    # GT8004 API Gateway
    gt8004_api_url: str = "https://api.gt8004.xyz"

    # GT8004 SDK (Platform Agent's own telemetry)
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
