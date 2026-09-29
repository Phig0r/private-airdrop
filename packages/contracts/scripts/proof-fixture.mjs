import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, BarretenbergSync, BackendType, UltraHonkBackend } from "@aztec/bb.js";
import init, * as crypto from "../../crypto-lib/pkg/crypto_lib.js";

// Public test inputs. This wallet is never used by the application.
await init({ module_or_path: await readFile(new URL("../../crypto-lib/pkg/crypto_lib_bg.wasm", import.meta.url)) });
const hashes = await BarretenbergSync.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
crypto.set_pedersen_hasher(inputs => hashes.pedersenHash({ inputs: inputs.map(value => Uint8Array.from(value)), hashIndex: 0 }).hash);
const privateKey = "01".repeat(32);
const address = crypto.walletAddress(privateKey);
const recipient = "0x1234567890abcdef1234567890abcdef12345678";
const initial = crypto.leafFromPhrase(address, "verifier test", "55", "0");
const nullifier = crypto.nullifierHash(initial);
const tier = crypto.deriveTierKey("123", "456", nullifier);
const account = crypto.leafFromPhrase(address, "verifier test", "55", tier);
const tree = crypto.buildTree([crypto.hashLeaf(account)]);
const signature = crypto.signMessage(privateKey, recipient, "55");
const publicKey = crypto.recoverPublicKey(recipient, "55", signature);
const inputs = crypto.circuitInputs(account, tree, 0, recipient, publicKey, signature);
const circuit = JSON.parse(await readFile(new URL("../../crypto-lib/pkg/circuit.json", import.meta.url)));
const { witness } = await new Noir(circuit).execute(inputs);
const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1 });
try {
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const result = await backend.generateProof(witness, { verifierTarget: "evm" });
  if (!await backend.verifyProof(result, { verifierTarget: "evm" })) throw new Error("Fixture proof failed verification.");
  const directory = new URL("../test/fixtures/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("proof.json", directory), JSON.stringify({
    proof: "0x" + Buffer.from(result.proof).toString("hex"), publicInputs: result.publicInputs,
  }, null, 2) + "\n");
  console.log("Real proof fixture generated with the Rust helpers and Noir circuit.");
} finally { await api.destroy(); await hashes.destroy(); }
