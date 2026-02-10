"""
ERC-8004 Token Minting Script for Base Sepolia
===============================================
Mints a new agent identity token on the ERC-8004 Identity Registry.

Usage:
    pip install web3 python-dotenv
    python erc8004/mint.py

Environment (.env):
    EVM_PRIVATE_KEY       - Deployer wallet private key
    AGENT_NAME            - Agent name for on-chain metadata
    AGENT_DESCRIPTION     - Agent description for on-chain metadata
    AGENT_VERSION         - Agent version for on-chain metadata
    BASE_SEPOLIA_RPC      - RPC endpoint
    IDENTITY_REGISTRY     - Contract address

Note: Endpoint is NOT included in on-chain metadata for privacy.
"""

import json
import os
import sys
import base64
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

# Load shared .env from parent directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

CHAIN_ID = int(os.environ.get("CHAIN_ID", "84532"))
DEFAULT_RPC = "https://base-sepolia-rpc.publicnode.com"
DEFAULT_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e"

REGISTRY_ABI = [
    {
        "inputs": [{"name": "agentURI", "type": "string"}],
        "name": "register",
        "outputs": [{"name": "tokenId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "tokenId", "type": "uint256"},
            {"indexed": True, "name": "wallet", "type": "address"},
            {"indexed": False, "name": "agentURI", "type": "string"},
        ],
        "name": "AgentRegistered",
        "type": "event",
    },
]


def build_agent_uri() -> str:
    """Build a data: URI with agent identity metadata (no endpoint exposed)."""
    metadata = {
        "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        "name": os.environ.get("AGENT_NAME", "Friend-Agent"),
        "description": os.environ.get(
            "AGENT_DESCRIPTION",
            "General-purpose LLM agent supporting chat, summarization, translation, and code assistance via A2A protocol",
        ),
        "version": os.environ.get("AGENT_VERSION", "1.0.0"),
        "services": [],
        "active": True,
    }
    encoded = base64.b64encode(json.dumps(metadata).encode()).decode()
    return f"data:application/json;base64,{encoded}"


def main():
    private_key = os.environ.get("EVM_PRIVATE_KEY")
    if not private_key:
        print("Error: EVM_PRIVATE_KEY is required")
        sys.exit(1)

    rpc_url = os.environ.get("BASE_SEPOLIA_RPC", DEFAULT_RPC)
    registry_addr = os.environ.get("IDENTITY_REGISTRY", DEFAULT_REGISTRY)

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print(f"Error: Cannot connect to {rpc_url}")
        sys.exit(1)

    account = w3.eth.account.from_key(private_key)
    print(f"Wallet:   {account.address}")
    print(f"Chain:    Base Sepolia ({CHAIN_ID})")
    print(f"Registry: {registry_addr}")
    print(f"Name:     {os.environ.get('AGENT_NAME', 'Friend-Agent')}")
    print(f"Version:  {os.environ.get('AGENT_VERSION', '1.0.0')}")
    print(f"Endpoint: (not exposed on-chain)")

    balance = w3.eth.get_balance(account.address)
    balance_eth = w3.from_wei(balance, "ether")
    print(f"Balance:  {balance_eth} ETH")

    if balance == 0:
        print("Error: No ETH for gas. Get testnet ETH from a Base Sepolia faucet.")
        sys.exit(1)

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(registry_addr),
        abi=REGISTRY_ABI,
    )

    agent_uri = build_agent_uri()
    print(f"\nagentURI: {agent_uri[:80]}...")

    nonce = w3.eth.get_transaction_count(account.address)
    base_fee = w3.eth.gas_price
    priority_fee = w3.to_wei(0.1, "gwei")
    max_fee = max(base_fee * 2, priority_fee + base_fee)
    tx = contract.functions.register(agent_uri).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gas": 500_000,
        "maxFeePerGas": max_fee,
        "maxPriorityFeePerGas": priority_fee,
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"\nTx sent: {tx_hash.hex()}")
    print("Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt.status != 1:
        print("Error: Transaction reverted")
        sys.exit(1)

    token_id = None
    for log in receipt.logs:
        try:
            event = contract.events.AgentRegistered().process_log(log)
            token_id = event["args"]["tokenId"]
            break
        except Exception:
            continue

    print(f"\nMinted successfully!")
    print(f"Token ID:  {token_id}")
    print(f"Tx Hash:   {tx_hash.hex()}")
    print(f"Block:     {receipt.blockNumber}")
    print(f"Explorer:  https://sepolia.basescan.org/tx/{tx_hash.hex()}")
    print(f"\nNext step: Set ERC8004_TOKEN_ID={token_id} in .env, then run:")
    print(f"  python register/register.py")


if __name__ == "__main__":
    main()
