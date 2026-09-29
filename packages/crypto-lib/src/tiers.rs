use crate::{Result, field_to_bytes};
use hmac::{Hmac, Mac};
use num_bigint::BigUint;
use sha2::Sha256;

/// Tier derivation v1. All arguments are canonical BN254 scalars encoded BE32.
/// The nonce is the circuit nullifier hash, never the raw secret or seed.
pub fn derive_tier_key(master: &str, context: &str, nullifier: &str) -> Result<String> {
    let mut mac = Hmac::<Sha256>::new_from_slice(&field_to_bytes(master)?).unwrap();
    mac.update(b"private-airdrop/tier-key/v1");
    mac.update(&field_to_bytes(context)?);
    mac.update(&field_to_bytes(nullifier)?);
    let modulus = BigUint::parse_bytes(
        b"30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001",
        16,
    )
    .unwrap();
    Ok((BigUint::from_bytes_be(&mac.finalize().into_bytes()) % modulus).to_string())
}
