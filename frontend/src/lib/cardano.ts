// Cardano Transaction Building Utilities for HydroX
// Uses Lucid Evolution for transaction construction
// Note: lucid-evolution is dynamically imported to avoid SSR issues with WASM

import { getLucid } from '../lucid-lace';
import { oracleApi, configApi, OraclePriceFeed, ContractConfig } from './api';

// Re-export types for convenience
export type { OraclePriceFeed, ContractConfig };

// ============================================================================
// Types matching Aiken on-chain types
// ============================================================================

/**
 * PositionDatum - matches Aiken PositionDatum
 * All values must be integers matching on-chain representation
 */
export interface PositionDatum {
  trader: string;           // VerificationKeyHash (hex)
  collateral: bigint;       // USD amount (no decimals on-chain)
  entry_price: bigint;      // Price scaled by 1e6
  size: bigint;             // Position size scaled by 1e8 for BTC
  is_long: boolean;
  leverage: number;         // 1-100
  timestamp: bigint;        // POSIX seconds
  vault_script_hash: string; // ByteArray (hex)
}

/**
 * OraclePriceFeed for on-chain use
 */
export interface OnChainOracleFeed {
  symbol: Uint8Array;      // Symbol as bytes
  price: bigint;           // Price scaled by 1e6
  timestamp: bigint;       // POSIX seconds
  signature: Uint8Array;   // Ed25519 signature
}

/**
 * ClosePosition Redeemer
 */
export interface ClosePositionRedeemer {
  oracle_feed: OnChainOracleFeed;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert API OraclePriceFeed to on-chain format
 */
export function toOnChainOracleFeed(feed: OraclePriceFeed): OnChainOracleFeed {
  return {
    symbol: stringToBytes(feed.symbol),
    price: BigInt(feed.price),
    timestamp: BigInt(feed.timestamp),
    signature: hexToBytes(feed.signature),
  };
}

/**
 * Get the payment key hash from an address (async for dynamic import)
 */
export async function getPaymentKeyHash(address: string): Promise<string> {
  const { getAddressDetails } = await import('@lucid-evolution/lucid');
  const details = getAddressDetails(address);
  if (!details.paymentCredential?.hash) {
    throw new Error('Could not extract payment key hash from address');
  }
  return details.paymentCredential.hash;
}

// ============================================================================
// CBOR Encoding for Aiken Types
// ============================================================================

/**
 * Encode PositionDatum to CBOR (Plutus Data format)
 * Aiken constructor format: Constr(index, fields)
 * PositionDatum has 8 fields
 */
export async function encodePositionDatum(datum: PositionDatum): Promise<string> {
  const { Data, Constr } = await import('@lucid-evolution/lucid');
  // Encode as Constr with fields
  return Data.to(
    new Constr(0, [  // First constructor
      datum.trader,                    // ByteArray
      datum.collateral,                // Int
      datum.entry_price,               // Int
      datum.size,                      // Int
      datum.is_long ? BigInt(1) : BigInt(0),  // Bool as Int
      BigInt(datum.leverage),          // Int
      datum.timestamp,                 // Int
      datum.vault_script_hash,         // ByteArray
    ])
  );
}

/**
 * Encode ClosePosition redeemer
 * ClosePosition { oracle_feed: OraclePriceFeed }
 */
export async function encodeClosePositionRedeemer(oracleFeed: OnChainOracleFeed): Promise<string> {
  const { Data, Constr } = await import('@lucid-evolution/lucid');
  // ClosePosition is the second constructor (index 1)
  // OraclePriceFeed is a nested constructor
  const oracleFeedData = new Constr(0, [
    bytesToHex(oracleFeed.symbol),     // ByteArray as hex string
    oracleFeed.price,                  // Int
    oracleFeed.timestamp,              // Int
    bytesToHex(oracleFeed.signature),  // ByteArray as hex string
  ]);

  return Data.to(
    new Constr(1, [oracleFeedData])  // ClosePosition is index 1 (0: OpenPosition, 1: ClosePosition, 2: Liquidate, 3: AddCollateral)
  );
}

// ============================================================================
// Position Operations
// ============================================================================

/**
 * Result of closing a position on-chain
 */
export interface ClosePositionResult {
  txHash: string;
  closePrice: number;
  pnl: number;
  pnlPercent: number;
}

/**
 * Close a position on-chain
 *
 * This builds and submits a transaction that:
 * 1. Consumes the Position UTxO from position script
 * 2. Consumes the Vault UTxO (for PnL settlement)
 * 3. Includes signed oracle price in redeemer
 * 4. Pays trader their collateral +/- PnL
 *
 * @param positionUtxo - The UTxO containing the position
 * @param vaultUtxo - The Vault UTxO for settlement
 * @param symbol - Asset symbol (e.g., "BTC")
 */
export async function closePositionOnChain(
  positionUtxoRef: { txHash: string; outputIndex: number },
  vaultUtxoRef: { txHash: string; outputIndex: number },
  symbol: string,
): Promise<ClosePositionResult> {
  const lucid = getLucid();
  if (!lucid) throw new Error('Lucid not initialized. Connect wallet first.');

  // 1. Get contract config
  const config = await configApi.getContractConfig();

  // 2. Get signed oracle price
  const oracleFeed = await oracleApi.getSignedPrice(symbol);
  const onChainFeed = toOnChainOracleFeed(oracleFeed);

  // 3. Find the UTxOs
  const positionUtxos = await lucid.utxosAt(config.position_script_addr);
  const positionUtxo = positionUtxos.find(
    u => u.txHash === positionUtxoRef.txHash && u.outputIndex === positionUtxoRef.outputIndex
  );
  if (!positionUtxo) throw new Error('Position UTxO not found');

  const vaultUtxos = await lucid.utxosAt(config.vault_script_addr);
  const vaultUtxo = vaultUtxos.find(
    u => u.txHash === vaultUtxoRef.txHash && u.outputIndex === vaultUtxoRef.outputIndex
  );
  if (!vaultUtxo) throw new Error('Vault UTxO not found');

  // 4. Build the transaction
  const closeRedeemer = await encodeClosePositionRedeemer(onChainFeed);

  const walletAddress = await lucid.wallet().address();
  const paymentKeyHash = await getPaymentKeyHash(walletAddress);

  // Build TX (simplified - actual implementation needs script loading)
  const tx = await lucid
    .newTx()
    .collectFrom([positionUtxo], closeRedeemer)
    .collectFrom([vaultUtxo])  // Vault redeemer would be SettlePnL
    .addSignerKey(paymentKeyHash)
    .validFrom(Date.now() - 60000)  // Valid from 1 minute ago
    .validTo(Date.now() + 300000)   // Valid for 5 minutes
    .complete();

  // 5. Sign and submit
  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  // 6. Calculate PnL for return value
  const closePrice = oracleFeed.price / 1_000_000; // Unscale

  return {
    txHash,
    closePrice,
    pnl: 0,        // Would need position data to calculate
    pnlPercent: 0, // Would need position data to calculate
  };
}

/**
 * Get position UTxO for a given position ID
 * Position ID format: txHash#outputIndex
 */
export function parsePositionId(positionId: string): { txHash: string; outputIndex: number } {
  const [txHash, indexStr] = positionId.split('#');
  return {
    txHash,
    outputIndex: parseInt(indexStr, 10),
  };
}

/**
 * Find all position UTxOs for a wallet address
 */
export async function findPositionUtxos(walletAddress: string): Promise<Array<{
  utxo: { txHash: string; outputIndex: number };
  datum: PositionDatum;
}>> {
  const lucid = getLucid();
  if (!lucid) throw new Error('Lucid not initialized');

  const config = await configApi.getContractConfig();
  const utxos = await lucid.utxosAt(config.position_script_addr);

  const traderPkh = await getPaymentKeyHash(walletAddress);

  const positions: Array<{
    utxo: { txHash: string; outputIndex: number };
    datum: PositionDatum;
  }> = [];

  for (const utxo of utxos) {
    if (!utxo.datum) continue;

    try {
      // Parse datum (simplified - would need proper CBOR decoding)
      // In production, use proper Plutus Data parsing
      const datum = await parsePositionDatum(utxo.datum);
      if (datum.trader === traderPkh) {
        positions.push({
          utxo: { txHash: utxo.txHash, outputIndex: utxo.outputIndex },
          datum,
        });
      }
    } catch (e) {
      // Skip UTxOs with invalid datums
      continue;
    }
  }

  return positions;
}

/**
 * Parse PositionDatum from CBOR
 * This is a simplified parser - in production use proper Plutus Data parsing
 */
async function parsePositionDatum(cborHex: string): Promise<PositionDatum> {
  const { Data } = await import('@lucid-evolution/lucid');
  const data = Data.from(cborHex);

  // Extract fields from constructor
  const fields = (data as { fields: unknown[] }).fields;

  return {
    trader: fields[0] as string,
    collateral: fields[1] as bigint,
    entry_price: fields[2] as bigint,
    size: fields[3] as bigint,
    is_long: (fields[4] as bigint) === BigInt(1),
    leverage: Number(fields[5] as bigint),
    timestamp: fields[6] as bigint,
    vault_script_hash: fields[7] as string,
  };
}

/**
 * Find the current Vault UTxO
 */
export async function findVaultUtxo(): Promise<{ txHash: string; outputIndex: number } | null> {
  const lucid = getLucid();
  if (!lucid) throw new Error('Lucid not initialized');

  const config = await configApi.getContractConfig();
  const utxos = await lucid.utxosAt(config.vault_script_addr);

  // Find the main vault UTxO (the one with the most USD)
  let maxUsdm = BigInt(0);
  let vaultUtxo: { txHash: string; outputIndex: number } | null = null;

  for (const utxo of utxos) {
    const usdmAmount = utxo.assets[`${config.usdm_policy_id}${config.usdm_asset_name}`] || BigInt(0);
    if (usdmAmount > maxUsdm) {
      maxUsdm = usdmAmount;
      vaultUtxo = { txHash: utxo.txHash, outputIndex: utxo.outputIndex };
    }
  }

  return vaultUtxo;
}
