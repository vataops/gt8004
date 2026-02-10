-- Add chain_id to agents table for network identification
ALTER TABLE agents ADD COLUMN chain_id INT DEFAULT 0;

-- Backfill from network_agents using erc8004_token_id + evm_address match
UPDATE agents a
SET chain_id = na.chain_id
FROM network_agents na
WHERE a.erc8004_token_id = na.token_id
  AND LOWER(a.evm_address) = LOWER(na.owner_address)
  AND a.erc8004_token_id IS NOT NULL
  AND a.evm_address IS NOT NULL
  AND a.evm_address != '';
