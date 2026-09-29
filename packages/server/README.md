# Participant API, tier issuer and relayer

Stores participant leaf hashes in MongoDB, keeps tier settings privately, and submits claims from an authorized Sepolia wallet. It does not store participant secrets or serve Merkle paths.

## Configure

Requires Node.js **22.12+**, MongoDB and a deployed diamond. Install workspace dependencies with `pnpm install --frozen-lockfile` from the root, then copy this directory's `.env.example` to `.env`.

Set `MONGODB_URI`, `MONGODB_DATABASE`, `RPC_URL`, `DIAMOND_ADDRESS` and `RELAYER_PRIVATE_KEY`. The relayer key's wallet must match the diamond's `relayer()` and hold Sepolia ETH for gas. Keep the key server-side.

## Run

From this directory:

```sh
pnpm dev       # Restart on source changes
pnpm start     # Run without a watcher
```

There is no compilation step or separate server test command. Startup checks MongoDB, the network and relayer authorization. The API listens on `127.0.0.1:3001` by default; Vite proxies `/api` to it. Restart after changing `.env`.

Run one server process for this demo. Preserve `private-keys/` (or `ISSUER_KEY_DIRECTORY`): it holds the tier settings needed during registration and claim setup. Keep it private and backed up. MongoDB remains dedicated to participant leaf hashes.

For hosting, provide HTTPS and a same-origin API proxy. See the [root README](../../README.md) for the workflow and the [technical report](../../research/Private-Airdrop-Technical-Report.pdf) for the privacy boundaries.
