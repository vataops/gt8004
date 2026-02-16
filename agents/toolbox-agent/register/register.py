"""
GT8004 Platform Registration Script
====================================
Registers the agent with the GT8004 Registry service,
linking the ERC-8004 token via wallet signature verification.

Usage:
    pip install web3 requests python-dotenv
    python register/register.py

Environment (.env):
    EVM_PRIVATE_KEY       - Wallet private key (must own the ERC-8004 token)
    AGENT_URL             - Cloud Run URL
    AGENT_NAME            - Agent display name
    REGISTRY_URL          - GT8004 Registry API base URL
    ERC8004_TOKEN_ID      - Token ID from mint
    CHAIN_ID              - Chain ID (default: 84532)
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import requests
from eth_account import Account
from eth_account.messages import encode_defunct

# Load shared .env from parent directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def main():
    private_key = os.environ.get("EVM_PRIVATE_KEY")
    if not private_key:
        print("Error: EVM_PRIVATE_KEY is required")
        sys.exit(1)

    registry_url = os.environ.get("REGISTRY_URL", "").rstrip("/")
    if not registry_url:
        print("Error: REGISTRY_URL is required (e.g. https://testnet-gt8004-registry-867247378343.us-central1.run.app)")
        sys.exit(1)

    agent_url = os.environ.get("AGENT_URL", "")
    if not agent_url:
        print("Error: AGENT_URL is required")
        sys.exit(1)

    token_id = os.environ.get("ERC8004_TOKEN_ID", "")
    if not token_id:
        print("Error: ERC8004_TOKEN_ID is required (run erc8004/mint.py first)")
        sys.exit(1)
    token_id = int(token_id)

    chain_id = int(os.environ.get("CHAIN_ID", "84532"))
    agent_name = os.environ.get("AGENT_NAME", "Toolbox Agent")

    account = Account.from_key(private_key)
    wallet = account.address
    print(f"Wallet:     {wallet}")
    print(f"Registry:   {registry_url}")
    print(f"Agent URL:  {agent_url}")
    print(f"Agent Name: {agent_name}")
    print(f"Token ID:   {token_id}")
    print(f"Chain:      {chain_id}")

    # Step 1: Request challenge from server
    print("\n[1/3] Requesting challenge...")
    resp = requests.post(
        f"{registry_url}/v1/auth/challenge",
        json={"agent_id": wallet},
    )
    if resp.status_code != 200:
        print(f"Error: challenge request failed: {resp.status_code} {resp.text}")
        sys.exit(1)

    challenge_data = resp.json()
    challenge_hex = challenge_data["challenge"]
    print(f"Challenge:  {challenge_hex[:20]}... (expires: {challenge_data['expires_at']})")

    # Step 2: Sign challenge with wallet (personal_sign / EIP-191)
    print("\n[2/3] Signing challenge...")
    challenge_bytes = bytes.fromhex(challenge_hex)
    message = encode_defunct(primitive=challenge_bytes)
    signed = account.sign_message(message)
    signature = signed.signature.hex()
    print(f"Signature:  0x{signature[:20]}...")

    # Step 3: Register with signed challenge
    print("\n[3/3] Registering agent...")
    register_body = {
        "name": agent_name,
        "origin_endpoint": agent_url,
        "protocols": ["a2a", "mcp"],
        "erc8004_token_id": token_id,
        "chain_id": chain_id,
        "wallet_address": wallet,
        "challenge": challenge_hex,
        "signature": "0x" + signature,
    }

    resp = requests.post(
        f"{registry_url}/v1/services/register",
        json=register_body,
    )

    if resp.status_code == 201:
        data = resp.json()
        print("\nRegistered successfully!")
        print(f"Agent ID:   {data['agent_id']}")
        print(f"API Key:    {data['api_key']}")
        print(f"Endpoint:   {data['gt8004_endpoint']}")
        print(f"Dashboard:  {data['dashboard_url']}")
        print(f"Tier:       {data['tier']}")
    elif resp.status_code == 409:
        print(f"\nError: Token already registered - {resp.json().get('error', '')}")
    else:
        print(f"\nError: Registration failed: {resp.status_code}")
        print(resp.text)
        sys.exit(1)


if __name__ == "__main__":
    main()
