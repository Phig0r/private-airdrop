import { loadEnvFile } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { run } from "./tools.mjs";

const directory = fileURLToPath(new URL("../", import.meta.url));
// 1. Load public deployment settings. Foundry reads the encrypted signing account.
try { loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url))); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const { RPC_URL, DIAMOND_OWNER, RELAYER_ADDRESS, FOUNDRY_ACCOUNT } = process.env;
if (!RPC_URL || !/^0x[0-9a-fA-F]{40}$/.test(DIAMOND_OWNER || "") ||
    !/^0x[0-9a-fA-F]{40}$/.test(RELAYER_ADDRESS || "") || !FOUNDRY_ACCOUNT)
  throw new Error("Set RPC_URL, DIAMOND_OWNER, RELAYER_ADDRESS and FOUNDRY_ACCOUNT in contracts/.env.");

// 2. Stop before building or sending anything if the RPC is not Sepolia.
const response = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
if (BigInt((await response.json()).result) !== 11155111n) throw new Error("Use a Sepolia RPC (11155111).");

// 3. Build the circuit/verifier pair and export the exact contract interfaces.
await import("./generate-verifier.mjs");
run("forge", ["build"], directory);
await import("./export-abi.mjs");

const broadcast = process.argv.includes("--broadcast");
// 4. Simulate by default. --broadcast explicitly sends the deployment transactions.
const settings = [
  `DIAMOND_OWNER=${DIAMOND_OWNER}`,
  `RELAYER_ADDRESS=${RELAYER_ADDRESS}`,
  `DEMO_ENABLED=${process.env.DEMO_ENABLED === "true"}`,
];
const command = [
  "forge", "script", "script/Deploy.s.sol:Deploy",
  "--rpc-url", RPC_URL,
  "--account", FOUNDRY_ACCOUNT,
  ...(broadcast ? ["--broadcast", "--slow"] : []),
  ...(process.argv.includes("--verify") ? ["--verify"] : []),
];
if (process.argv.includes("--verify")) {
  if (!process.env.ETHERSCAN_API_KEY) throw new Error("Set ETHERSCAN_API_KEY before using --verify.");
  settings.push(`ETHERSCAN_API_KEY=${process.env.ETHERSCAN_API_KEY}`);
}
run("env", [...settings, ...command], directory);

if (broadcast) {
  // 5. Share the confirmed diamond address with the server and web app.
  const report = JSON.parse(await readFile(new URL("../broadcast/Deploy.s.sol/11155111/run-latest.json", import.meta.url), "utf8"));
  const diamond = report.transactions.find(tx => tx.contractName === "Diamond" && tx.transactionType === "CREATE")?.contractAddress;
  if (!diamond) throw new Error("Diamond address was not found in the deployment report.");
  for (const [file, key] of [["../.env", "DIAMOND_ADDRESS"], ["../../server/.env", "DIAMOND_ADDRESS"], ["../../web/.env", "VITE_DIAMOND_ADDRESS"]]) {
    const url = new URL(file, import.meta.url);
    let contents = await readFile(url, "utf8").catch(() => "");
    const line = new RegExp(`^${key}=.*$`, "m");
    contents = line.test(contents) ? contents.replace(line, `${key}=${diamond}`) : `${contents}\n${key}=${diamond}\n`;
    await writeFile(url, contents);
  }
  const contracts = Object.fromEntries(report.transactions
    .filter(tx => ["CREATE", "CREATE2"].includes(tx.transactionType) && tx.contractAddress)
    .map(tx => [tx.contractName, tx.contractAddress]));
  await writeFile(new URL("../deployment-sepolia.json", import.meta.url), JSON.stringify({
    chainId: 11155111, owner: DIAMOND_OWNER, relayer: RELAYER_ADDRESS,
    demoEnabled: process.env.DEMO_ENABLED === "true", contracts,
  }, null, 2) + "\n");
  console.log(`Diamond deployed at ${diamond}. App and server addresses updated.`);
} else console.log("Dry run finished. Add --broadcast to send the deployment transactions.");
