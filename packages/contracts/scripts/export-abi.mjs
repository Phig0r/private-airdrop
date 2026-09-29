import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const abi = [];
const seen = new Set();
for (const name of ["Diamond", "AdminFacet", "UserFacet"]) {
  const artifact = JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root), "utf8"));
  for (const item of artifact.abi) {
    if (["constructor", "fallback", "receive"].includes(item.type)) continue;
    const key = JSON.stringify(item);
    if (!seen.has(key)) { seen.add(key); abi.push(item); }
  }
}
await mkdir(new URL("abi/", root), { recursive: true });
await writeFile(new URL("abi/Airdrop.json", root), JSON.stringify(abi, null, 2) + "\n");
const faucet = JSON.parse(await readFile(new URL("out/DemoFaucet.sol/DemoFaucet.json", root), "utf8"));
await writeFile(new URL("abi/DemoFaucet.json", root), JSON.stringify(faucet.abi, null, 2) + "\n");
