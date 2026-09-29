use super::{fixtures, run};
use std::hash::pedersen_hash;

#[test]
fn one_owner_and_255_generated_leaves() {
    run(fixtures::valid());
}

#[test]
fn all_256_positions_in_one_tree() {
    for index in 0..256 {
        let mut c = fixtures::valid();
        c.secret = (index + 1) as Field;
        c.nullifier_hash = pedersen_hash([c.secret, c.nullifier_seed]);
        c.merkle_root = fixtures::full_tree_root();
        c.merkle_path = fixtures::full_tree_path(index);
        c.leaf_index = index as Field;
        run(c);
    }
}

#[test(should_fail)]
fn wrong_secret_even_with_matching_nullifier() {
    let mut c = fixtures::valid();
    c.secret = 999;
    c.nullifier_hash = pedersen_hash([c.secret, c.nullifier_seed]);
    run(c);
}

#[test(should_fail)]
fn wrong_seed_even_with_new_signature() {
    let changed = fixtures::changed_seed();
    let mut c = fixtures::valid();
    c.nullifier_seed = changed.nullifier_seed;
    c.nullifier_hash = changed.nullifier_hash;
    c.signature = changed.signature;
    run(c);
}

#[test(should_fail)]
fn wrong_tier_key() {
    let mut c = fixtures::valid();
    c.tier_key = c.tier_key + 1;
    run(c);
}

#[test(should_fail)]
fn reversed_path() {
    let original = fixtures::valid();
    let mut c = original;
    for i in 0..8 { c.merkle_path[i] = original.merkle_path[7 - i]; }
    run(c);
}

#[test(should_fail)]
fn path_from_another_leaf() {
    let mut c = fixtures::valid();
    c.merkle_path = fixtures::full_tree_path(173);
    run(c);
}

#[test(should_fail)]
fn index_above_255() {
    let mut c = fixtures::valid();
    c.leaf_index = 256;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_0() {
    let mut c = fixtures::valid();
    c.merkle_path[0] = c.merkle_path[0] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_1() {
    let mut c = fixtures::valid();
    c.merkle_path[1] = c.merkle_path[1] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_2() {
    let mut c = fixtures::valid();
    c.merkle_path[2] = c.merkle_path[2] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_3() {
    let mut c = fixtures::valid();
    c.merkle_path[3] = c.merkle_path[3] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_4() {
    let mut c = fixtures::valid();
    c.merkle_path[4] = c.merkle_path[4] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_5() {
    let mut c = fixtures::valid();
    c.merkle_path[5] = c.merkle_path[5] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_6() {
    let mut c = fixtures::valid();
    c.merkle_path[6] = c.merkle_path[6] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_sibling_7() {
    let mut c = fixtures::valid();
    c.merkle_path[7] = c.merkle_path[7] + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_0() {
    let mut c = fixtures::valid();
    c.leaf_index = 1;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_1() {
    let mut c = fixtures::valid();
    c.leaf_index = 2;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_2() {
    let mut c = fixtures::valid();
    c.leaf_index = 4;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_3() {
    let mut c = fixtures::valid();
    c.leaf_index = 8;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_4() {
    let mut c = fixtures::valid();
    c.leaf_index = 16;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_5() {
    let mut c = fixtures::valid();
    c.leaf_index = 32;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_6() {
    let mut c = fixtures::valid();
    c.leaf_index = 64;
    run(c);
}

#[test(should_fail)]
fn wrong_index_bit_7() {
    let mut c = fixtures::valid();
    c.leaf_index = 128;
    run(c);
}
