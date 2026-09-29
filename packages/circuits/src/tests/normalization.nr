use super::{fixtures, run};
use std::hash::pedersen_hash;
use keccak256::keccak256;

#[test]
fn rust_leaf_hash_matches_noir() {
    let c = fixtures::valid();
    assert(pedersen_hash([fixtures::owner_address(), c.secret, c.nullifier_seed, c.tier_key]) == fixtures::leaf_hash());
}

#[test]
fn request_nonce_is_exactly_the_circuit_nullifier_hash() {
    let c = fixtures::valid();
    assert(pedersen_hash([c.secret, c.nullifier_seed]) == c.nullifier_hash);
    assert(pedersen_hash([c.nullifier_seed]) != c.nullifier_hash);
}

#[test]
fn signature_message_uses_big_endian_field_bytes() {
    let c = fixtures::valid();
    assert(pedersen_hash([c.recipient, c.nullifier_seed]).to_be_bytes() == fixtures::message());
}

#[test]
fn wallet_address_comes_from_uncompressed_public_key() {
    let c = fixtures::valid();
    let digest = keccak256(crate::combine_32_bytes(c.pub_key_x, c.pub_key_y), 64);
    let mut address = [0; 20];
    for i in 0..20 { address[i] = digest[i + 12]; }
    assert(Field::from_be_bytes(address) == fixtures::owner_address());
}

#[test]
fn equivalent_decimal_and_hex_fields() {
    let mut c = fixtures::valid();
    assert(c.nullifier_seed == 4660);
    c.nullifier_seed = 0x1234;
    run(c);
}

#[test]
fn independent_pedersen_vector() {
    assert(pedersen_hash([0x1234567890abcdef1234567890abcdef12345678, 1193046, 9991764, 1])
        == 0x1688235ddf120df0f7187f6843cf0df3a1405fbf6b0ad7277df0c58fb5b2175d);
}
