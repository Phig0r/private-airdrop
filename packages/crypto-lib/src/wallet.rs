use crate::fields::hex_bytes;
use crate::*;
use k256::ecdsa::{
    RecoveryId, Signature, SigningKey, VerifyingKey, signature::hazmat::PrehashVerifier,
};
use sha3::{Digest, Keccak256};
pub(crate) fn parse_public_key(value: &str) -> Result<VerifyingKey> {
    let bytes = hex_bytes(value)?;
    if bytes.len() != 65 || bytes[0] != 4 {
        return Err(Error::InvalidPublicKey);
    }
    VerifyingKey::from_sec1_bytes(&bytes).map_err(|_| Error::InvalidPublicKey)
}
pub fn public_key_address(value: &str) -> Result<String> {
    let key = parse_public_key(value)?.to_encoded_point(false);
    Ok(format!(
        "0x{}",
        hex::encode(&Keccak256::digest(&key.as_bytes()[1..])[12..])
    ))
}
pub fn eip191_digest(message: &[u8; 32]) -> [u8; 32] {
    Keccak256::digest([b"\x19Ethereum Signed Message:\n32".as_slice(), message].concat()).into()
}
fn parse_signature(value: &str) -> Result<(Signature, Option<RecoveryId>)> {
    let bytes = hex_bytes(value)?;
    let recovery = if bytes.len() == 65 {
        Some(
            RecoveryId::try_from(match bytes[64] {
                0 | 1 => bytes[64],
                27 | 28 => bytes[64] - 27,
                _ => return Err(Error::InvalidSignature),
            })
            .map_err(|_| Error::InvalidSignature)?,
        )
    } else if bytes.len() == 64 {
        None
    } else {
        return Err(Error::InvalidSignature);
    };
    let signature = Signature::from_slice(&bytes[..64]).map_err(|_| Error::InvalidSignature)?;
    // Ethereum wallets return canonical low-s signatures; do not silently rewrite them.
    if signature.normalize_s().is_some() {
        return Err(Error::InvalidSignature);
    }
    Ok((signature, recovery))
}
pub fn recover_public_key(recipient: &str, seed: &str, signature_hex: &str) -> Result<String> {
    let (signature, recovery) = parse_signature(signature_hex)?;
    let key = VerifyingKey::recover_from_prehash(
        &eip191_digest(&signing_message(recipient, seed)?),
        &signature,
        recovery.ok_or(Error::InvalidSignature)?,
    )
    .map_err(|_| Error::InvalidSignature)?;
    Ok(format!(
        "0x{}",
        hex::encode(key.to_encoded_point(false).as_bytes())
    ))
}
pub fn verify_wallet_signature(
    recipient: &str,
    seed: &str,
    public_key: &str,
    signature_hex: &str,
) -> Result<Vec<u8>> {
    let (signature, _) = parse_signature(signature_hex)?;
    parse_public_key(public_key)?
        .verify_prehash(
            &eip191_digest(&signing_message(recipient, seed)?),
            &signature,
        )
        .map_err(|_| Error::InvalidSignature)?;
    Ok(signature.to_bytes().to_vec())
}
/// Deterministic signing for local test wallets. Real wallets supply personal_sign.
pub fn sign_message(private_key: &str, message: &[u8; 32]) -> Result<String> {
    let key =
        SigningKey::from_slice(&hex_bytes(private_key)?).map_err(|_| Error::InvalidPublicKey)?;
    let (signature, recovery) = key
        .sign_prehash_recoverable(&eip191_digest(message))
        .map_err(|_| Error::InvalidSignature)?;
    Ok(format!(
        "0x{}{:02x}",
        hex::encode(signature.to_bytes()),
        recovery.to_byte() + 27
    ))
}
pub fn public_key_from_private(private_key: &str) -> Result<String> {
    let key =
        SigningKey::from_slice(&hex_bytes(private_key)?).map_err(|_| Error::InvalidPublicKey)?;
    Ok(format!(
        "0x{}",
        hex::encode(key.verifying_key().to_encoded_point(false).as_bytes())
    ))
}
