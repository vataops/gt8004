---
allowed-tools: Read, Glob, Grep, Bash(aiken check:*), Bash(aiken build:*), Bash(aiken blueprint:*), WebSearch, Task
argument-hint: [focus: security|backend|hydra|full]
description: Aiken smart contract security audit and backend integration verification
---

## Context

- Project: Agent Exchange - Cardano P2P Trading Platform
- Contract path: `contracts/` (Aiken v1.1.21, Plutus V3, stdlib v3.0.0)
- Blueprint: `contracts/plutus.json`
- Validator: `contracts/validators/listing.ak`
- Types: `contracts/lib/types.ak`
- Utils: `contracts/lib/utils.ak`
- Tests: `contracts/lib/tests.ak`
- Backend (planned): Go API server with Operation Key system
- L2: Hydra Head (isomorphic execution)

## Your Task

Determine audit scope from **$ARGUMENTS**. Default is `full`.

### Phase 1: Read All Contract Code

Read every `.ak` file and understand the full logic:
- `contracts/lib/types.ak` - Datum/Redeemer types
- `contracts/lib/utils.ak` - Helper functions
- `contracts/validators/listing.ak` - Validator logic
- `contracts/lib/tests.ak` - Existing tests
- `contracts/plutus.json` - Compiled blueprint

### Phase 2: Security Audit (focus: security or full)

Check each Cardano/eUTxO-specific vulnerability one by one:

**[ ] Double Satisfaction Attack**
- When multiple UTxOs from the same validator are spent in one TX, does each redeemer validation run independently?
- Can a single payment output satisfy `verify_payment` for multiple listings simultaneously?
- Mitigation: check if each listing UTxO consumption requires a separate output to the seller

**[ ] Datum Hijacking**
- Can an attacker create a UTxO with a malicious datum to bypass the validator?
- Verify only inline datums are used; check if datum-hash-based attacks are possible

**[ ] Reference Input Exploitation**
- Can listing UTxOs be read as reference inputs to extract exploitable information?

**[ ] Value Draining (Update path)**
- Is the continuing output value strictly preserved during `Update`?
- Can min-ADA manipulation be used to drain tokens?

**[ ] Expiry Bypass**
- Does `not_expired` correctly check validity_range upper_bound?
- What happens if an attacker submits a TX without a validity_range?

**[ ] Redeemer Forgery**
- What happens if the `buyer` field in `Purchase { buyer }` is manipulated?
- Verify that the buyer must be in extra_signatories, preventing unsigned manipulation

**[ ] Missing On-chain Checks**
- Does Cancel verify on-chain that assets are returned to the seller? (or is this off-chain trust?)
- Does Purchase verify on-chain that the buyer receives the listed assets?
- Can a free listing be created with `ask_lovelace == 0 && ask_token_amount == 0`?

**[ ] Integer Overflow / Underflow**
- Negative price value handling

**[ ] Script Size & Execution Cost**
- Analyze CPU/MEM costs from `aiken check`
- Identify scenarios where execution cost might exceed TX limits

### Phase 3: Backend Integration Verification (focus: backend or full)

**[ ] Plutus Blueprint Compatibility**
- Verify datum/redeemer schema in `plutus.json` uses raw `Data` type
- Confirm correct Constr indices for `ListingDatum` when CBOR-encoding in Go backend
- Document Plutus Data representation for each type (Constr index, field order)

**[ ] Operation Key System Compatibility**
- Verify `seller` field is VerificationKeyHash (28 bytes)
- Confirm the derivation path: Ed25519 public key → Blake2b_224 hash → PKH
- Document the `extra_signatories` requirement for Operation Key PKH

**[ ] TX Building Guide**
- For each redeemer (Cancel, Purchase, Update), document:
  - Required inputs, outputs, signatories, validity_range
  - CBOR encoding with Constr numbers and field ordering

### Phase 4: Hydra L2 Compatibility (focus: hydra or full)

**[ ] Isomorphic Execution**
- Does the validator behave identically on L1 and inside a Hydra Head?
- Are there Hydra Head UTxO model constraints that affect this validator?

**[ ] Hydra-specific Scenarios**
- When the Head closes, is the listing UTxO datum preserved during fan-out to L1?
- Can concurrent transactions within the Head create conflicts?
- What happens if two buyers try to purchase the same listing before snapshot confirmation?

### Phase 5: Test Coverage Analysis

- List scenarios covered by existing tests
- **Identify missing test scenarios**:
  - Edge cases (empty datum, zero price, negative price, etc.)
  - Attack scenarios (double satisfaction, datum hijacking, etc.)
  - Validator-level tests (currently only utils functions are tested)
- Write the missing tests in Aiken syntax, add to `contracts/lib/tests.ak`
- Run `aiken check` to verify all new tests pass

### Phase 6: Output Report

Output the final results in this format:

```
## Contract Audit Report

### Summary
- Severity: [CRITICAL / HIGH / MEDIUM / LOW / INFO]
- Findings: N items

### Findings

#### [1] Title (Severity: HIGH)
- Location: `file:line`
- Description: ...
- Impact: ...
- Recommended Fix: ...
- Aiken code patch (if applicable): ...

### Backend Integration Notes
- Datum CBOR Encoding: ...
- TX Building Requirements: ...

### Hydra Compatibility Notes
- ...

### Test Coverage
- Current coverage: X%
- Additional tests needed: N
- Tests added: N (with `aiken check` results)
```

## Important

- Do NOT guess. Read code directly and verify.
- Include concrete attack scenarios for each vulnerability found.
- Propose specific Aiken code patches for items that need fixing.
- If new tests are written, confirm they pass with `aiken check`.
- Be thorough but concise. Focus on actionable findings.
