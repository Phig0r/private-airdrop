# Web application

React interface for participants and administrators. It connects to MetaMask, reads the contracts, prepares inputs through Rust/WASM and generates proofs in the browser.

## Setup

Requires Node.js **22.12+**, MetaMask on Sepolia and the [server](../server/README.md). Install dependencies from the root with `pnpm install --frozen-lockfile`.

Copy this directory's `.env.example` to `.env`. Set `VITE_RPC_URL` and `VITE_DIAMOND_ADDRESS` for the same deployment used by the server. These values are public; never add private keys here.

## Commands

From this directory:

```sh
pnpm dev            # Development server; open the printed URL
pnpm build          # Production assets in dist/
pnpm preview        # Serve the production build locally
pnpm build:crypto   # Rebuild Rust/WASM and the circuit artifact
```

The crypto build needs the [Rust/WASM toolchain](../crypto-lib/README.md). There is no separate web test script. Restart Vite after editing `.env`; rebuild before previewing changed source or configuration.

The API is proxied to port 3001. Hosting needs an equivalent proxy and the COOP/COEP headers in `vite.config.js` for proof workers.

Both demo modes use the admin interface. View-only mode disables writes; demo owners can manage airdrops, while withdrawals and access settings remain restricted to the super owner. See the [root README](../../README.md) for the full workflow.
