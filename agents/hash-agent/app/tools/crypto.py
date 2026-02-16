"""
Pure-function cryptographic utilities.
No LLM, no network calls — just hash, encode, checksum, UUID.
"""

import hashlib
import base64
import uuid as _uuid


def hash_text(text: str, algorithm: str = "sha256") -> str:
    """
    Compute hash of text.
    Supports: sha256, md5, keccak256.
    """
    data = text.encode("utf-8")
    algo = algorithm.lower().strip()

    if algo == "sha256":
        return hashlib.sha256(data).hexdigest()
    elif algo == "md5":
        return hashlib.md5(data).hexdigest()
    elif algo == "keccak256":
        # Python's hashlib exposes keccak as sha3_256 is NOT keccak256.
        # keccak256 (pre-SHA3-final) uses hashlib's _keccak if available,
        # otherwise fall back to manual construction via sha3 internals.
        # The correct approach: use hashlib with "sha3_256" for SHA3-256,
        # but Ethereum's keccak256 is the pre-NIST version.
        # We use the pysha3-compatible path or the built-in approach.
        try:
            k = hashlib.new("keccak_256", data)
        except ValueError:
            # Fallback: sha3_256 is NOT the same as keccak256 but some
            # environments label it differently. For strict correctness,
            # we implement keccak256 via the _keccak sponge if available.
            # In CPython 3.12+, hashlib may support "keccak_256" natively
            # via OpenSSL 3.x. If not, raise a clear error.
            try:
                import _pysha3  # noqa: F401
                k = hashlib.new("keccak_256", data)
            except (ImportError, ValueError):
                # Last resort: use sha3_256 and note the difference
                return f"error: keccak256 not available in this environment (sha3_256 != keccak256). Install pysha3 or use Python with OpenSSL 3.2+."
        return k.hexdigest()
    else:
        return f"error: unsupported algorithm '{algorithm}'. Supported: sha256, md5, keccak256"


def encode_text(text: str, mode: str = "base64_encode") -> str:
    """
    Encode or decode text.
    Modes: base64_encode, base64_decode, hex_encode, hex_decode.
    """
    m = mode.lower().strip()

    if m == "base64_encode":
        return base64.b64encode(text.encode("utf-8")).decode("ascii")
    elif m == "base64_decode":
        try:
            return base64.b64decode(text.encode("ascii")).decode("utf-8")
        except Exception as e:
            return f"error: base64 decode failed — {e}"
    elif m == "hex_encode":
        return text.encode("utf-8").hex()
    elif m == "hex_decode":
        try:
            return bytes.fromhex(text).decode("utf-8")
        except Exception as e:
            return f"error: hex decode failed — {e}"
    else:
        return f"error: unsupported mode '{mode}'. Supported: base64_encode, base64_decode, hex_encode, hex_decode"


def checksum_address(address: str) -> str:
    """
    EIP-55 checksum validation for Ethereum addresses.
    Computes the checksum manually using keccak-256 (no web3 dependency).
    Returns the checksummed address or an error message.
    """
    addr = address.strip()

    # Strip 0x prefix for processing
    if addr.startswith("0x") or addr.startswith("0X"):
        addr = addr[2:]

    # Validate length and hex chars
    if len(addr) != 40:
        return f"error: invalid address length ({len(addr) + 2} chars, expected 42)"

    try:
        int(addr, 16)
    except ValueError:
        return f"error: address contains non-hex characters"

    # Compute keccak256 of lowercased address
    addr_lower = addr.lower()
    try:
        addr_hash = hashlib.new("keccak_256", addr_lower.encode("ascii")).hexdigest()
    except ValueError:
        try:
            import _pysha3  # noqa: F401
            addr_hash = hashlib.new("keccak_256", addr_lower.encode("ascii")).hexdigest()
        except (ImportError, ValueError):
            return f"error: keccak256 not available in this environment. Install pysha3 or use Python with OpenSSL 3.2+."

    # Apply EIP-55 checksum rules
    checksummed = "0x"
    for i, char in enumerate(addr_lower):
        if char in "0123456789":
            checksummed += char
        elif int(addr_hash[i], 16) >= 8:
            checksummed += char.upper()
        else:
            checksummed += char

    return checksummed


def generate_uuid(namespace: str = "", name: str = "") -> str:
    """
    Generate UUID.
    - No args: UUID v4 (random)
    - namespace + name: UUID v5 (deterministic, SHA-1 based)
    """
    if namespace and name:
        # Map well-known namespace strings to uuid constants
        ns_map = {
            "dns": _uuid.NAMESPACE_DNS,
            "url": _uuid.NAMESPACE_URL,
            "oid": _uuid.NAMESPACE_OID,
            "x500": _uuid.NAMESPACE_X500,
        }
        ns = ns_map.get(namespace.lower())
        if ns is None:
            # Try parsing as a UUID string
            try:
                ns = _uuid.UUID(namespace)
            except ValueError:
                # Use DNS as default namespace with the provided namespace as part of the name
                ns = _uuid.NAMESPACE_DNS
                name = f"{namespace}:{name}"
        return str(_uuid.uuid5(ns, name))
    else:
        return str(_uuid.uuid4())
