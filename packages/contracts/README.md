# Solidity contracts

An EIP-2535 diamond routes administration and claims to two facets. A generated Noir verifier checks proofs; a separate faucet grants optional demo roles. Registration stays off chain.

## Build and test

Requires Foundry, Nargo **1.0.0-beta.26**, Node.js and workspace dependencies (`pnpm install --frozen-lockfile` from the root). From this directory:

```sh
forge build
forge test
node scripts/export-abi.mjs
```

On Windows, run direct Foundry commands in WSL. The Node scripts invoke Foundry/Nargo through WSL themselves. Exported ABI files are shared with the browser and server.

## Regenerate proof artifacts

```sh
node scripts/generate-verifier.mjs
node scripts/proof-fixture.mjs
```

The first command compiles the circuit, updates the browser circuit artifact and generates its Solidity verifier. The second creates the real proof fixture used by verifier tests. The fixture command requires the [WASM helpers](../crypto-lib/README.md). Rebuild and rerun `forge test` afterward. Keep Barretenberg **5.2.0** and browser proof settings aligned.

## Deploy to Sepolia

Copy `.env.example` to `.env`. Set the RPC, deployer address, relayer address and Etherscan API key. Import the deployer into an encrypted Foundry account:

```sh
cast wallet import privateAirdrop --interactive
```

Set `FOUNDRY_ACCOUNT=privateAirdrop`; `DIAMOND_OWNER` must match that account. Choose whether to allow demo role requests with `DEMO_ENABLED`.

```sh
node scripts/deploy.mjs                       # Simulate
node scripts/deploy.mjs --broadcast --verify  # Deploy and verify
```

The script installs both facet selector sets, connects the verifier, and registers the faucet. On success it updates contract/server/web `.env` addresses and writes `deployment-sepolia.json`. Restart the server and rebuild or restart the frontend.

If verification fails after transactions succeed, inspect the broadcast receipts and verify those addresses rather than redeploying blindly. This storage layout is not a compatible upgrade of an older on-chain-registration design.

Fund the diamond for rewards and the relayer separately for gas. Only the super owner can withdraw pool ETH. See the [technical report](../../research/Private-Airdrop-Technical-Report.pdf) for protocol details and the [root README](../../README.md) for the current deployment.
