mod fixtures;
mod membership;
mod ownership;
mod public_inputs;
mod normalization;

// Test input container only. run() calls the real circuit without extra checks.
pub struct Claim {
    pub_key_x: [u8; 32],
    pub_key_y: [u8; 32],
    signature: [u8; 64],
    secret: Field,
    nullifier_seed: Field,
    tier_key: Field,
    nullifier_hash: Field,
    merkle_root: Field,
    merkle_path: [Field; 8],
    leaf_index: Field,
    recipient: Field,
}

pub fn run(c: Claim) {
    crate::main(c.pub_key_x, c.pub_key_y, c.signature, c.secret,
        c.nullifier_seed, c.tier_key, c.nullifier_hash, c.merkle_root,
        c.merkle_path, c.leaf_index, c.recipient);
}
