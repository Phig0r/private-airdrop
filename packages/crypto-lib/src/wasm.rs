//! Browser bindings only; all conversions and tree operations live in the core modules.
use crate::*;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
thread_local! { static HASHER: RefCell<Option<js_sys::Function>> = const { RefCell::new(None) }; }
fn error(e: Error) -> JsValue {
    serde_wasm_bindgen::to_value(&e).unwrap()
}
fn decode<T: serde::de::DeserializeOwned>(value: JsValue) -> std::result::Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|_| error(Error::InvalidInput))
}
fn encode<T: serde::Serialize>(value: crate::Result<T>) -> std::result::Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&value.map_err(error)?).map_err(|_| error(Error::InvalidInput))
}
#[wasm_bindgen]
pub fn set_pedersen_hasher(hasher: js_sys::Function) {
    HASHER.with(|h| *h.borrow_mut() = Some(hasher));
}
pub(crate) fn pedersen(inputs: Vec<Vec<u8>>) -> crate::Result<Vec<u8>> {
    HASHER.with(|h| {
        let arg = serde_wasm_bindgen::to_value(&inputs).map_err(|_| Error::HashBackend)?;
        let value = h
            .borrow()
            .as_ref()
            .ok_or(Error::HashBackend)?
            .call1(&JsValue::NULL, &arg)
            .map_err(|_| Error::HashBackend)?;
        let bytes = js_sys::Uint8Array::new(&value).to_vec();
        if bytes.len() != 32 {
            return Err(Error::HashBackend);
        }
        Ok(bytes)
    })
}
#[wasm_bindgen(js_name = normalizeField)]
pub fn field(value: &str) -> std::result::Result<JsValue, JsValue> {
    encode(normalize_field(value))
}
#[wasm_bindgen(js_name = textToField)]
pub fn text(value: &str) -> std::result::Result<JsValue, JsValue> {
    encode(text_to_field(value))
}
#[wasm_bindgen(js_name = addressToField)]
pub fn address(value: &str) -> std::result::Result<JsValue, JsValue> {
    encode(address_to_field(value))
}
#[wasm_bindgen(js_name = leafFromPhrase)]
pub fn leaf(
    address: &str,
    phrase: &str,
    seed: &str,
    tier: &str,
) -> std::result::Result<JsValue, JsValue> {
    encode(leaf_from_phrase(address, phrase, seed, tier))
}
#[wasm_bindgen(js_name = hashLeaf)]
pub fn leaf_hash(value: JsValue) -> std::result::Result<JsValue, JsValue> {
    encode(hash_leaf(&decode(value)?))
}
#[wasm_bindgen(js_name = nullifierHash)]
pub fn nullifier(value: JsValue) -> std::result::Result<JsValue, JsValue> {
    encode(nullifier_hash(&decode(value)?))
}
#[wasm_bindgen(js_name = buildTree)]
pub fn tree(value: JsValue) -> std::result::Result<JsValue, JsValue> {
    encode(build_tree_from_hashes(&decode::<Vec<String>>(value)?))
}
#[wasm_bindgen(js_name = deriveTierKey)]
pub fn tier_key(
    master: &str,
    context: &str,
    nullifier: &str,
) -> std::result::Result<JsValue, JsValue> {
    encode(derive_tier_key(master, context, nullifier))
}
#[wasm_bindgen(js_name = findPath)]
pub fn path(value: JsValue, leaf: &str) -> std::result::Result<JsValue, JsValue> {
    let tree: MerkleTree = decode(value)?;
    encode(tree.find_path(leaf))
}
#[wasm_bindgen(js_name = validateTree)]
pub fn validate(value: JsValue) -> std::result::Result<JsValue, JsValue> {
    let tree: MerkleTree = decode(value)?;
    encode(tree.validate().map(|_| tree.root().to_string()))
}
#[wasm_bindgen(js_name = signingMessage)]
pub fn message(recipient: &str, seed: &str) -> std::result::Result<JsValue, JsValue> {
    encode(signing_message(recipient, seed).map(|v| format!("0x{}", hex::encode(v))))
}
#[wasm_bindgen(js_name = recoverPublicKey)]
pub fn recover(
    recipient: &str,
    seed: &str,
    signature: &str,
) -> std::result::Result<JsValue, JsValue> {
    encode(recover_public_key(recipient, seed, signature))
}
#[wasm_bindgen(js_name = walletAddress)]
pub fn wallet_address(private_key: &str) -> std::result::Result<JsValue, JsValue> {
    encode(public_key_from_private(private_key).and_then(|key| public_key_address(&key)))
}
#[wasm_bindgen(js_name = signMessage)]
pub fn sign(
    private_key: &str,
    recipient: &str,
    seed: &str,
) -> std::result::Result<JsValue, JsValue> {
    encode(signing_message(recipient, seed).and_then(|msg| sign_message(private_key, &msg)))
}
#[wasm_bindgen(js_name = circuitInputs)]
pub fn inputs(
    account: JsValue,
    tree: JsValue,
    index: usize,
    recipient: &str,
    public_key: &str,
    signature: &str,
) -> std::result::Result<JsValue, JsValue> {
    encode(circuit_inputs(
        &decode(account)?,
        &decode(tree)?,
        index,
        recipient,
        public_key,
        signature,
    ))
}
