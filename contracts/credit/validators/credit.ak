use aiken/collection/list
use cardano/transaction.{Transaction}

/// Actions that can be performed with the CREDIT token.
pub type CreditAction {
  /// Mint new CREDIT tokens for a channel.
  Mint { channel_id: ByteArray }
  /// Burn CREDIT tokens during settlement.
  Burn { channel_id: ByteArray }
}

/// CREDIT minting policy parameterized by the AEL operator's
/// verification key hash. Only the operator can mint or burn.
validator credit_policy(operator_pkh: ByteArray) {
  mint(action: CreditAction, _policy_id: ByteArray, tx: Transaction) -> Bool {
    let operator_signed = list.has(tx.extra_signatories, operator_pkh)

    when action is {
      Mint { .. } -> operator_signed
      Burn { .. } -> operator_signed
    }
  }

  else(_) {
    fail
  }
}
