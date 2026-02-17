from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8080
    google_api_key: str = ""
    llm_model: str = "gemini-2.0-flash"
    agent_name: str = "Stablecoin Search Agent"
    agent_description: str = (
        "Collateralized stablecoin analysis agent for the Ethereum ecosystem — "
        "provides in-depth research on DAI, LUSD, crvUSD, GHO, FRAX, USDe, USDS and more, "
        "covering collateral structures, stability mechanisms, and risk profiles"
    )
    agent_version: str = "1.0.0"
    agent_url: str = ""
    a2a_base_url: str = ""
    provider_org: str = ""
    provider_url: str = ""
    log_level: str = "info"

    # x402 Payment
    x402_pay_to: str = ""
    x402_network: str = "base"
    x402_price: str = "$0.01"

    # GT8004 SDK
    gt8004_agent_id: str = ""
    gt8004_api_key: str = ""
    gt8004_ingest_url: str = "https://ingest.gt8004.xyz/v1/ingest"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
