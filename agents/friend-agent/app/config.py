from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"
    agent_name: str = "Friend Agent"
    agent_description: str = "General-purpose LLM agent supporting chat, summarization, translation, and code assistance via A2A protocol"
    agent_version: str = "1.0.0"
    agent_url: str = ""
    provider_org: str = ""
    provider_url: str = ""
    log_level: str = "info"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://api.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
