import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Barretenberg, BackendType, UltraHonkBackend } from "@aztec/bb.js";
import { run } from "./tools.mjs";

// Compile once, then give the browser and verifier the same circuit artifact.
run("nargo", ["compile", "--program-dir", "packages/circuits"]);
const artifact = new URL("../../circuits/target/circuits.json", import.meta.url);
await copyFile(artifact, new URL("../../crypto-lib/pkg/circuit.json", import.meta.url));
const contents = await readFile(artifact);
const circuit = JSON.parse(contents);
const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1 });
try {
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const options = { verifierTarget: "evm" };
  const vk = await backend.getVerificationKey(options);
  const source = await backend.getSolidityVerifier(vk, options);
  const directory = new URL("../src/verifier/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("Verifier.sol", directory), "// src/verifier/Verifier.sol\n" + source);
  await writeFile(new URL("manifest.json", directory), JSON.stringify({
    barretenberg: "5.2.0", target: "evm",
    circuitSha256: createHash("sha256").update(contents).digest("hex"),
    verificationKeySha256: createHash("sha256").update(vk).digest("hex"),
  }, null, 2) + "\n");
  console.log("Verifier generated from the browser's circuit.");
} finally { await api.destroy(); }
