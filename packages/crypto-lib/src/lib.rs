//! Pure input/output helpers for the unchanged eight-level Noir circuit.
mod fields;
mod tiers;
mod tree;
mod wallet;
#[cfg(target_arch = "wasm32")]
mod wasm;
pub use fields::*;
use serde::{Deserialize, Serialize};
pub use tiers::*;
pub use tree::*;
pub use wallet::*;

pub const TREE_DEPTH: usize = 8;
pub const LEAF_COUNT: usize = 1 << TREE_DEPTH;
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Error {
    InvalidField,
    FieldOverflow,
    InvalidHex,
    InvalidAddress,
    EmptyText,
    InvalidTree,
    InvalidCount,
    DuplicateLeaf,
    LeafNotFound,
    InvalidIndex,
    InvalidPublicKey,
    InvalidSignature,
    WalletMismatch,
    HashBackend,
    InvalidInput,
}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LeafData {
    pub address: String,
    pub secret: String,
    pub nullifier_seed: String,
    pub tier_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CircuitInputs {
    pub pub_key_x: Vec<u8>,
    pub pub_key_y: Vec<u8>,
    pub signature: Vec<u8>,
    pub secret: String,
    pub nullifier_seed: String,
    pub tier_key: String,
    pub nullifier_hash: String,
    pub merkle_root: String,
    pub merkle_path: Vec<String>,
    pub leaf_index: String,
    pub recipient: String,
}

pub fn circuit_inputs(
    account: &LeafData,
    tree: &MerkleTree,
    index: usize,
    recipient: &str,
    public_key_hex: &str,
    signature_hex: &str,
) -> Result<CircuitInputs> {
    tree.validate()?;
    let merkle_path = tree.merkle_path(index)?;
    if hash_leaf(account)? != normalize_field(&tree.levels()[0][index])? {
        return Err(Error::LeafNotFound);
    }
    let key = parse_public_key(public_key_hex)?;
    if public_key_address(public_key_hex)?.to_lowercase()
        != format!("0x{}", hex::encode(address_bytes(&account.address)?))
    {
        return Err(Error::WalletMismatch);
    }
    let signature = verify_wallet_signature(
        recipient,
        &account.nullifier_seed,
        public_key_hex,
        signature_hex,
    )?;
    let key = key.to_encoded_point(false);
    Ok(CircuitInputs {
        pub_key_x: key.as_bytes()[1..33].to_vec(),
        pub_key_y: key.as_bytes()[33..].to_vec(),
        signature,
        secret: normalize_field(&account.secret)?,
        nullifier_seed: normalize_field(&account.nullifier_seed)?,
        tier_key: normalize_field(&account.tier_key)?,
        nullifier_hash: nullifier_hash(account)?,
        merkle_root: normalize_field(tree.root())?,
        merkle_path,
        leaf_index: index.to_string(),
        recipient: address_to_field(recipient)?,
    })
}
