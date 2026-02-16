from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    google_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"
    agent_name: str = "Companion Agent"
    agent_description: str = "General-purpose LLM agent supporting chat, summarization, translation, and code assistance via A2A protocol"
    agent_version: str = "1.0.0"
    agent_url: str = ""
    log_level: str = "info"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://testnet.ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
