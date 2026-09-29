use std::ecdsa_secp256k1::verify_signature;
use std::hash::pedersen_hash;
use keccak256::keccak256;
mod tests;

pub fn combine_32_bytes(a: [u8; 32], b: [u8; 32]) -> [u8; 64] {
    let mut combined: [u8; 64] = [0; 64];
    
    for i in 0..32 {
        combined[i] = a[i];
        combined[i + 32] = b[i];
    }

    combined
}

fn compute_merkle_root(leaf: Field, path: [Field;8], index:Field) -> Field {
    let index_bits: [bool;8] = index.to_le_bits();

    let mut current = leaf;
    for i in 0..8 {
        if !index_bits[i] { current = pedersen_hash([current, path[i]]);}
        else { current = pedersen_hash([path[i],current]);}
    }
    
    current
}

global EIP191_PREFIX: [u8; 28] = [
    0x19,
    0x45, 0x74, 0x68, 0x65, 0x72, 0x65, 0x75, 0x6d, 0x20, 
    0x53, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x20,             
    0x4d, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65, 0x3a, 0x0a,
    0x33, 0x32                                            
];

fn main(
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],

    secret: Field,
    nullifier_seed: Field,

    tier_key: pub Field,
    nullifier_hash: pub Field,
    merkle_root: pub Field,
    merkle_path: [Field; 8],
    leaf_index: Field,

    recipient: pub Field
) {

    // signature verification (ownerhsip)
    let message_hash: [u8;32] = pedersen_hash([recipient, nullifier_seed]).to_be_bytes();

    let mut eip191_msg: [u8; 60] = [0; 60];
    for i in 0..28 {
        eip191_msg[i] = EIP191_PREFIX[i];
    }
    for i in 0..32 {
        eip191_msg[i + 28] = message_hash[i];
    }

    let eth_signed_msg: [u8; 32] = keccak256(eip191_msg, 60);

    let is_valid = verify_signature(
        pub_key_x,
        pub_key_y,
        signature,
        eth_signed_msg
    );
    assert(is_valid);

    //retrieving the public key
    let pub_key: [u8; 64] = combine_32_bytes(pub_key_x, pub_key_y);
    let output_hash: [u8; 32] = keccak256(pub_key, 64);

    let mut pub_key_bytes: [u8; 20] = [0; 20];
    for i in 0..20 {
        pub_key_bytes[i] = output_hash[i + 12];
    }

    let pub_key_field: Field = Field::from_be_bytes(pub_key_bytes);
   
    // reconstruct merkle root
    let computed_leaf = pedersen_hash([
        pub_key_field,
        secret,
        nullifier_seed,
        tier_key
    ]);

    let computed_root = compute_merkle_root(computed_leaf, merkle_path, leaf_index);

    assert(computed_root == merkle_root);

    // compute Nullifier 
    let computed_nullifier = pedersen_hash([secret, nullifier_seed]);

    assert(computed_nullifier == nullifier_hash);
}
