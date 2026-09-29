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

## Deploy a hosted server

Keep the service root at the repository root: the server also reads `packages/contracts/abi/Airdrop.json`. Use Node.js 22.12+ and pnpm.

- Install/build command: `pnpm install --frozen-lockfile` (there is no server compilation step).
- Start command: `pnpm --filter @airdrop/server start`.
- Set `HOST=0.0.0.0` and use the port supplied by the hosting service.
- Set the MongoDB, Sepolia RPC, diamond address and relayer environment variables listed above on the server host.
- Mount persistent storage and set `ISSUER_KEY_DIRECTORY` to a directory on that mount. Preserve existing issuer files when migrating an active instance; MongoDB does not contain those tier settings.
- Run one instance; the request queues coordinate only within one process.

On Render, choose a Node **Web Service**, connect `Phig0r/private-airdrop` on `main`, and leave Root Directory blank. Set `HOST=0.0.0.0`; Render supplies `PORT`. For persistent issuer files, attach a disk (requires a paid service), mount it at `/var/data`, and set `ISSUER_KEY_DIRECTORY=/var/data/issuer-keys`. Without persistent storage, restarts or deployments lose the private tier configuration. See [Render web services](https://render.com/docs/web-services) and [persistent disks](https://render.com/docs/disks).

The frontend at `https://private-airdrop.vercel.app/` calls `/api/...`. Configure a Vercel external rewrite to your server's HTTPS URL, preserving the `/api/` prefix. Vite's development proxy is not used in a deployed static build. See the [web deployment guide](../web/README.md#vercel-api-connection).
