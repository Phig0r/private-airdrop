use super::{fixtures, run};

#[test(should_fail)]
fn wrong_nullifier_hash() {
    let mut c = fixtures::valid();
    c.nullifier_hash = c.nullifier_hash + 1;
    run(c);
}

#[test(should_fail)]
fn wrong_merkle_root() {
    let mut c = fixtures::valid();
    c.merkle_root = c.merkle_root + 1;
    run(c);
}

// Accepted behavior that the application/contract must account for.
#[test]
fn replay_requires_contract_nullifier_tracking() {
    run(fixtures::valid());
    run(fixtures::valid());
}

#[test]
fn self_created_root_requires_contract_approval() {
    let c = fixtures::different_root();
    assert(c.merkle_root != fixtures::valid().merkle_root);
    run(c);
}

#[test]
fn master_key_relationship_is_not_enforced_by_this_circuit() {
    run(fixtures::arbitrary_tier());
}

#[test]
fn recipient_above_160_bits_is_currently_accepted() {
    run(fixtures::wide_recipient());
}

#[test]
fn same_wallet_recipient_is_only_blocked_by_the_app() {
    run(fixtures::same_wallet_recipient());
}

#[test]
fn recipient_address_boundaries() {
    run(fixtures::zero_recipient());
    run(fixtures::max_address_recipient());
}

#[test]
fn zero_and_maximum_registered_fields() {
    run(fixtures::zero_fields());
    run(fixtures::maximum_fields());
}
