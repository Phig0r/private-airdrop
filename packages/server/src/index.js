import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { createParticipantServer } from "./server.js";
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { createRelayer } from "./relayer.js";
import { createIssuer } from "./issuer.js";

try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const port = Number(process.env.PORT || 3001);
if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE ||
    !process.env.RPC_URL || !isAddress(process.env.DIAMOND_ADDRESS || "") ||
    !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Set MongoDB, RPC_URL, DIAMOND_ADDRESS and PORT in packages/server/.env.");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const abi = JSON.parse(await readFile(new URL("../../contracts/abi/Airdrop.json", import.meta.url), "utf8"));
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const chainId = (await provider.getNetwork()).chainId.toString();
  if (chainId !== "11155111") throw new Error("USE_SEPOLIA_RPC");
  const contract = new Contract(process.env.DIAMOND_ADDRESS, abi, provider);
  if (await provider.getCode(contract.target) === "0x") throw new Error("CONTRACT_NOT_DEPLOYED");
  const issuer = createIssuer(contract, chainId, process.env.ISSUER_KEY_DIRECTORY || fileURLToPath(new URL("../private-keys/", import.meta.url)));
  const relayer = createRelayer(contract, process.env.RELAYER_PRIVATE_KEY);
  if ((await contract.relayer()).toLowerCase() !== relayer.address.toLowerCase()) throw new Error("RELAYER_NOT_AUTHORIZED");
  const scope = `${chainId}_${contract.target.toLowerCase()}`;
  const server = createParticipantServer(client.db(process.env.MONGODB_DATABASE), contract, issuer, scope, relayer);
  server.listen(port, "127.0.0.1", () => {
    console.log(`Participant API: http://127.0.0.1:${port}`);
  });
  server.on("error", async () => {
    console.error("Unable to start participant API. Check PORT.");
    await client.close();
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.close(async () => {
      await client.close();
      process.exit(0);
    }));
  }
} catch {
  console.error("Startup failed. Check MongoDB, Sepolia RPC, deployed diamond, shared ABI and authorized RELAYER_PRIVATE_KEY.");
  await client.close();
  process.exitCode = 1;
}
