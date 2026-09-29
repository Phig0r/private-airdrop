use crate::{Error, LeafData, Result};
use num_bigint::BigUint;
use sha3::{Digest, Keccak256};
const MODULUS: &str = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";
fn modulus() -> BigUint {
    BigUint::parse_bytes(MODULUS.as_bytes(), 16).unwrap()
}
/// Numeric fields are never interpreted as text or reduced modulo p.
pub fn normalize_field(input: &str) -> Result<String> {
    let (digits, radix) = input
        .strip_prefix("0x")
        .or_else(|| input.strip_prefix("0X"))
        .map_or((input, 10), |hex| (hex, 16));
    if digits.is_empty()
        || digits.len() > 78
        || !digits.bytes().all(|b| {
            if radix == 16 {
                b.is_ascii_hexdigit()
            } else {
                b.is_ascii_digit()
            }
        })
    {
        return Err(Error::InvalidField);
    }
    let value = BigUint::parse_bytes(digits.as_bytes(), radix).ok_or(Error::InvalidField)?;
    if value >= modulus() {
        return Err(Error::FieldOverflow);
    }
    Ok(value.to_str_radix(10))
}
/// Phrase encoding v1: exact UTF-8 bytes -> Keccak-256 -> integer modulo p.
/// No trim, case conversion or Unicode normalization. Separate from numeric parsing.
pub fn text_to_field(text: &str) -> Result<String> {
    if text.is_empty() {
        return Err(Error::EmptyText);
    }
    Ok((BigUint::from_bytes_be(&Keccak256::digest(text.as_bytes())) % modulus()).to_str_radix(10))
}
pub fn field_to_bytes(input: &str) -> Result<[u8; 32]> {
    let bytes = BigUint::parse_bytes(normalize_field(input)?.as_bytes(), 10)
        .unwrap()
        .to_bytes_be();
    let mut output = [0; 32];
    output[32 - bytes.len()..].copy_from_slice(&bytes);
    Ok(output)
}
pub(crate) fn hex_bytes(input: &str) -> Result<Vec<u8>> {
    hex::decode(
        input
            .strip_prefix("0x")
            .or_else(|| input.strip_prefix("0X"))
            .unwrap_or(input),
    )
    .map_err(|_| Error::InvalidHex)
}
pub(crate) fn address_bytes(address: &str) -> Result<[u8; 20]> {
    hex_bytes(address)?
        .try_into()
        .map_err(|_| Error::InvalidAddress)
}
pub fn address_to_field(address: &str) -> Result<String> {
    Ok(BigUint::from_bytes_be(&address_bytes(address)?).to_string())
}
pub fn leaf_from_phrase(address: &str, phrase: &str, seed: &str, tier: &str) -> Result<LeafData> {
    Ok(LeafData {
        address: format!("0x{}", hex::encode(address_bytes(address)?)),
        secret: text_to_field(phrase)?,
        nullifier_seed: normalize_field(seed)?,
        tier_key: normalize_field(tier)?,
    })
}
pub fn hash_fields(fields: &[&str]) -> Result<String> {
    let inputs = fields
        .iter()
        .map(|f| field_to_bytes(f).map(|b| b.to_vec()))
        .collect::<Result<Vec<_>>>()?;
    #[cfg(not(target_arch = "wasm32"))]
    let hash = {
        use barretenberg_rs::{BarretenbergApi, backends::FfiBackend};
        BarretenbergApi::new(FfiBackend::new().map_err(|_| Error::HashBackend)?)
            .pedersen_hash(inputs, 0)
            .map_err(|_| Error::HashBackend)?
            .hash
    };
    #[cfg(target_arch = "wasm32")]
    let hash = crate::wasm::pedersen(inputs)?;
    normalize_field(&BigUint::from_bytes_be(&hash).to_string())
}
pub fn hash_leaf(account: &LeafData) -> Result<String> {
    hash_fields(&[
        &address_to_field(&account.address)?,
        &account.secret,
        &account.nullifier_seed,
        &account.tier_key,
    ])
}
pub fn hash_children(left: &str, right: &str) -> Result<String> {
    hash_fields(&[left, right])
}
pub fn nullifier_hash(account: &LeafData) -> Result<String> {
    hash_children(&account.secret, &account.nullifier_seed)
}
pub fn signing_message(recipient: &str, seed: &str) -> Result<[u8; 32]> {
    field_to_bytes(&hash_children(&address_to_field(recipient)?, seed)?)
}
