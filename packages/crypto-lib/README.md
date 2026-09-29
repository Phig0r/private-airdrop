# Cryptographic helpers

Rust functions for field conversion, hashing, tier-key derivation, wallet signatures and Merkle trees. The browser uses the same helpers through WebAssembly.

## Rust build and tests

With Rust installed, run from this directory:

```sh
cargo build --locked
cargo test --locked
```

Use WSL for native commands on Windows. The crate uses Rust edition 2024; dependency versions are recorded in `Cargo.lock`.

## Browser build

Install the WASM target and matching binding generator once:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.114 --locked
```

With Nargo **1.0.0-beta.26** available, run from this directory:

```sh
node scripts/build.mjs
```

On Windows the script invokes the build tools through WSL. It writes bindings, WASM and the compiled circuit to `pkg/`. Restart or rebuild the web app after changing these artifacts.

## Refresh circuit fixtures

```sh
cargo run --example noir_fixtures --locked
```

The [circuit test command](../circuits/README.md) already performs this step. Exact input encodings are described in the [technical report](../../research/Private-Airdrop-Technical-Report.pdf).
