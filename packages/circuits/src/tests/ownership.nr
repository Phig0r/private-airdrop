use super::{fixtures, run};

#[test(should_fail)]
fn knowing_the_address_does_not_allow_signing() {
    let mut c = fixtures::valid();
    c.signature = fixtures::outsider().signature;
    run(c);
}

#[test(should_fail)]
fn nonmember_with_valid_signature_and_stolen_secrets() {
    let outsider = fixtures::outsider();
    let mut c = fixtures::valid();
    c.pub_key_x = outsider.pub_key_x;
    c.pub_key_y = outsider.pub_key_y;
    c.signature = outsider.signature;
    run(c);
}

#[test(should_fail)]
fn empty_signature() {
    let mut c = fixtures::valid();
    c.signature = [0; 64];
    run(c);
}

#[test(should_fail)]
fn invalid_public_key() {
    let mut c = fixtures::valid();
    c.pub_key_x = [0; 32];
    c.pub_key_y = [0; 32];
    run(c);
}

#[test(should_fail)]
fn swapped_public_key_coordinates() {
    let original = fixtures::valid();
    let mut c = original;
    c.pub_key_x = original.pub_key_y;
    c.pub_key_y = original.pub_key_x;
    run(c);
}

#[test(should_fail)]
fn signature_without_eip191() {
    let mut c = fixtures::valid();
    c.signature = fixtures::raw_signature();
    run(c);
}

#[test(should_fail)]
fn signed_hex_text_instead_of_raw_bytes() {
    let mut c = fixtures::valid();
    c.signature = fixtures::text_signature();
    run(c);
}

#[test(should_fail)]
fn signed_little_endian_message() {
    let mut c = fixtures::valid();
    c.signature = fixtures::little_endian_signature();
    run(c);
}

#[test(should_fail)]
fn recipient_changed_without_owner_authorization() {
    let mut c = fixtures::valid();
    c.recipient = fixtures::new_recipient().recipient;
    run(c);
}

#[test]
fn owner_authorizes_new_recipient() {
    run(fixtures::new_recipient());
}

#[test(should_fail)]
fn changing_seed_invalidates_the_old_signature() {
    let mut c = fixtures::changed_seed();
    c.signature = fixtures::valid().signature;
    run(c);
}

#[test(should_fail)]
fn corrupt_signature_byte_0() {
    let mut c = fixtures::valid();
    c.signature[0] = c.signature[0] ^ 1;
    run(c);
}

#[test(should_fail)]
fn corrupt_signature_byte_31() {
    let mut c = fixtures::valid();
    c.signature[31] = c.signature[31] ^ 1;
    run(c);
}

#[test(should_fail)]
fn corrupt_signature_byte_32() {
    let mut c = fixtures::valid();
    c.signature[32] = c.signature[32] ^ 1;
    run(c);
}

#[test(should_fail)]
fn corrupt_signature_byte_63() {
    let mut c = fixtures::valid();
    c.signature[63] = c.signature[63] ^ 1;
    run(c);
}

#[test(should_fail)]
fn corrupt_pub_key_x_byte_0() {
    let mut c = fixtures::valid();
    c.pub_key_x[0] = c.pub_key_x[0] ^ 1;
    run(c);
}

#[test(should_fail)]
fn corrupt_pub_key_y_byte_0() {
    let mut c = fixtures::valid();
    c.pub_key_y[0] = c.pub_key_y[0] ^ 1;
    run(c);
}

#[test(should_fail)]
fn zero_r() {
    let mut c = fixtures::valid();
    for i in 0..32 { c.signature[i] = 0; }
    run(c);
}

#[test(should_fail)]
fn out_of_range_r() {
    let mut c = fixtures::valid();
    for i in 0..32 { c.signature[i] = 255; }
    run(c);
}

#[test(should_fail)]
fn zero_s() {
    let mut c = fixtures::valid();
    for i in 32..64 { c.signature[i] = 0; }
    run(c);
}

#[test(should_fail)]
fn out_of_range_s() {
    let mut c = fixtures::valid();
    for i in 32..64 { c.signature[i] = 255; }
    run(c);
}
