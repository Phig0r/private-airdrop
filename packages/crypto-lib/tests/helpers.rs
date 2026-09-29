mod common;
use common::build_demo_tree;
use crypto_lib::*;

fn account() -> LeafData {
    LeafData {
        address: "0x1234567890abcdef1234567890abcdef12345678".into(),
        secret: "0x123456".into(),
        nullifier_seed: "0x987654".into(),
        tier_key: "1".into(),
    }
}

#[test]
fn numeric_fields_and_addresses_are_not_text_hashes() {
    assert_eq!(normalize_field("0x10").unwrap(), "16");
    assert_eq!(normalize_field("10").unwrap(), "10");
    assert_eq!(normalize_field("00016").unwrap(), "16");
    assert_eq!(
        field_to_bytes("16").unwrap(),
        field_to_bytes("0X10").unwrap()
    );
    assert_eq!(
        address_to_field("0x0000000000000000000000000000000000000010").unwrap(),
        "16"
    );
    let mut decimal = account();
    decimal.secret = "1193046".into();
    decimal.nullifier_seed = "9991764".into();
    assert_eq!(hash_leaf(&account()).unwrap(), hash_leaf(&decimal).unwrap());
    // Independent @aztec/bb.js Pedersen vector, separator 0.
    assert_eq!(
        hash_leaf(&account()).unwrap(),
        normalize_field("0x1688235ddf120df0f7187f6843cf0df3a1405fbf6b0ad7277df0c58fb5b2175d")
            .unwrap()
    );
}

#[test]
fn rejects_ambiguous_malformed_and_out_of_range_values() {
    for input in [
        "",
        "0x",
        "ff",
        "-1",
        "+1",
        "1.0",
        " 1",
        "1 ",
        "0xgg",
        "0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001",
        &format!("0x{}", "f".repeat(64)),
    ] {
        assert!(normalize_field(input).is_err(), "accepted {input}");
    }
    assert!(
        normalize_field("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000")
            .is_ok()
    );
    assert_eq!(field_to_bytes("0").unwrap(), [0; 32]);
    for address in [
        "",
        "0x1",
        &format!("0x{}", "ff".repeat(21)),
        &"z".repeat(40),
    ] {
        assert!(address_to_field(address).is_err());
    }
}

#[test]
fn demo_tree_and_input_shapes() {
    let data = account();
    let tree = build_demo_tree(&data, 255).unwrap();
    assert_eq!(
        tree.levels().iter().map(Vec::len).collect::<Vec<_>>(),
        [256, 128, 64, 32, 16, 8, 4, 2, 1]
    );
    assert_eq!(tree.levels()[0][255], hash_leaf(&data).unwrap());
    assert_eq!(tree.root(), build_demo_tree(&data, 255).unwrap().root());
    assert_eq!(tree.merkle_path(255).unwrap().len(), 8);
    for index in [256, usize::MAX] {
        assert!(tree.merkle_path(index).is_err());
        assert!(build_demo_tree(&data, index).is_err());
    }
    for count in [0, 257] {
        assert!(build_tree(&vec![data.clone(); count]).is_err());
    }
    let private = "01".repeat(32);
    let key = public_key_from_private(&private).unwrap();
    let owner = LeafData {
        address: public_key_address(&key).unwrap(),
        ..data.clone()
    };
    let tree = build_demo_tree(&owner, 255).unwrap();
    let sig = sign_message(
        &private,
        &signing_message(&data.address, &owner.nullifier_seed).unwrap(),
    )
    .unwrap();
    let input = circuit_inputs(&owner, &tree, 255, &data.address, &key, &sig).unwrap();
    assert_eq!(input.pub_key_x.len(), 32);
    assert_eq!(input.pub_key_y.len(), 32);
    assert_eq!(input.signature.len(), 64);
    assert_eq!(
        recover_public_key(&data.address, &owner.nullifier_seed, &sig).unwrap(),
        key
    );
    assert!(circuit_inputs(&owner, &tree, 255, &owner.address, &key, &sig).is_err());
    assert!(circuit_inputs(&owner, &tree, 255, &data.address, "04", &sig).is_err());
    assert!(circuit_inputs(&owner, &tree, 0, &data.address, &key, &sig).is_err());
    let json = serde_json::to_value(input).unwrap();
    assert_eq!(json.as_object().unwrap().len(), 11);
    assert!(json["secret"].is_string());
    assert!(json["pub_key_x"][0].is_number());
}

#[test]
fn partial_tree_fillers_paths_and_untrusted_imports() {
    let leaf = hash_leaf(&account()).unwrap();
    let tree = build_tree_from_hashes(&[leaf.clone()]).unwrap();
    assert_eq!(tree.count, 1);
    assert_eq!(tree.levels()[0].len(), 256);
    for index in 0..256 {
        assert_eq!(
            root_from_path(
                &tree.levels()[0][index],
                &tree.merkle_path(index).unwrap(),
                index
            )
            .unwrap(),
            tree.root()
        );
    }
    assert_eq!(tree.find_path(&leaf).unwrap().leaf_index, 0);
    assert_eq!(tree.find_path(&tree.levels()[0][1]).unwrap().leaf_index, 1);
    assert_eq!(
        tree.levels()[0][1],
        hash_leaf(&filler_leaf(1).unwrap()).unwrap()
    );
    assert_eq!(
        build_tree_from_hashes(&[leaf.clone(), leaf]).unwrap_err(),
        Error::DuplicateLeaf
    );
    let value = serde_json::to_value(&tree).unwrap();
    for level in 0..9 {
        let mut tampered = value.clone();
        tampered["levels"][level][0] = "0".into();
        let tree: MerkleTree = serde_json::from_value(tampered).unwrap();
        assert!(tree.validate().is_err());
    }
    for bad in [
        serde_json::json!({"count":1,"levels":[]}),
        serde_json::json!({"count":257,"levels":[[]]}),
    ] {
        let tree: MerkleTree = serde_json::from_value(bad).unwrap();
        assert!(tree.validate().is_err());
        assert!(tree.find_path("0").is_err());
    }
}
#[test]
fn phrase_encoding_is_explicit_and_exact() {
    assert_ne!(text_to_field("10").unwrap(), normalize_field("10").unwrap());
    assert_ne!(
        text_to_field(" word").unwrap(),
        text_to_field("word").unwrap()
    );
    assert!(text_to_field("").is_err());
    assert_eq!(
        leaf_from_phrase(&account().address, "hello", "0x10", "01")
            .unwrap()
            .nullifier_seed,
        "16"
    );
}

#[test]
fn tier_key_is_reproducible_and_bound_to_all_three_inputs() {
    // Independently computed with Python's standard hmac/SHA-256 implementation.
    let expected = "7220853404773070991594409372403330924135183551185286536901400535849430469592";
    assert_eq!(derive_tier_key("42", "9", "123").unwrap(), expected);
    assert_eq!(derive_tier_key("0x2a", "0x09", "0x7b").unwrap(), expected);
    for (master, context, nonce) in [("43", "9", "123"), ("42", "10", "123"), ("42", "9", "124")] {
        assert_ne!(derive_tier_key(master, context, nonce).unwrap(), expected);
    }
    assert!(derive_tier_key("not a field", "9", "123").is_err());
}
