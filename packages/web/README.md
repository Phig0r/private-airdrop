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

## Vercel API connection

The committed `vercel.json` forwards API requests to `https://private-airdrop.onrender.com`. Matching configurations are provided at the repository root and in `packages/web`, so Vercel uses the file at its configured Root Directory. Keep these routing and header settings aligned if either changes:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://private-airdrop.onrender.com/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

The rewrite keeps browser API calls on the frontend origin, so this configuration does not need a frontend API URL variable or browser CORS access to the server. Keep `VITE_RPC_URL` and `VITE_DIAMOND_ADDRESS` configured for the same deployment as the server. The headers preserve the isolation required by the proof workers.

After redeployment, open `https://private-airdrop.vercel.app/api/health`: it should return `{"status":"ok"}`. This checks API routing and MongoDB connectivity, not claim funding or issuer configuration. For an existing airdrop, `/api/airdrops/<existing-airdrop-id>/status` returns JSON containing `configured`, `closed` and `count`. Check `window.crossOriginIsolated` in the browser console before testing proof generation.

Reference: [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).
