# Noir circuit

Proves wallet ownership, membership in an eight-level Merkle tree, and correct nullifier construction. Its four public inputs are the tier key, nullifier hash, root and recipient. The [technical report](../../research/Private-Airdrop-Technical-Report.pdf) explains the protocol.

## Compile and test

Requires Nargo **1.0.0-beta.26**, Rust and Node.js. From this directory:

```sh
nargo compile
node scripts/test.mjs
```

The test script regenerates fixtures using the Rust helpers, then runs native Noir tests. Append a test-name filter to run a subset:

```sh
node scripts/test.mjs membership
```

On Windows, the Node script uses WSL; run direct `nargo` commands inside WSL. Install workspace JavaScript dependencies from the root with `pnpm install --frozen-lockfile`.

After changing the circuit, rebuild the [browser artifacts](../crypto-lib/README.md) and [Solidity verifier](../contracts/README.md) together before using new proofs.
