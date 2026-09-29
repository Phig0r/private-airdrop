use crypto_lib::*;
pub fn build_demo_tree(account: &LeafData, index: usize) -> Result<MerkleTree> {
    if index >= LEAF_COUNT {
        return Err(Error::InvalidIndex);
    }
    let mut accounts = (0..LEAF_COUNT)
        .map(|i| LeafData {
            address: format!("0x{:040x}", i + 1),
            secret: (65536 + i).to_string(),
            nullifier_seed: (131072 + i).to_string(),
            tier_key: account.tier_key.clone(),
        })
        .collect::<Vec<_>>();
    accounts[index] = account.clone();
    build_tree(&accounts)
}
