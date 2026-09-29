import init, * as bindings from "../../crypto-lib/pkg/crypto_lib.js";
import wasmUrl from "../../crypto-lib/pkg/crypto_lib_bg.wasm?url";
import { BarretenbergSync, BackendType } from "@aztec/bb.js";
let initialization;
export function initializeCrypto() {
  return (initialization ||= (async () => {
    await init({ module_or_path: wasmUrl });
    const bb = await BarretenbergSync.new({
      backend: BackendType.Wasm,
      threads: 1,
      skipSrsInit: true,
    });
    bindings.set_pedersen_hasher(
      (inputs) =>
        bb.pedersenHash({
          inputs: inputs.map((bytes) => Uint8Array.from(bytes)),
          hashIndex: 0,
        }).hash,
    );
  })());
}
// Keep machine-readable Rust errors; the UI can translate the code at its boundary.
export const cryptoHelpers = new Proxy(
  {},
  {
    get:
      (_, name) =>
      (...args) => {
        try {
          return bindings[name](...args);
        } catch (code) {
          const error = new Error(String(code));
          error.code = String(code);
          throw error;
        }
      },
  },
);
export function randomField() {
  for (;;) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const hex =
      "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try {
      const field = cryptoHelpers.normalizeField(hex);
      if (field !== "0") return field;
    } catch (error) {
      if (error.code !== "FIELD_OVERFLOW") throw error;
    }
  }
}
let prover;
export async function proveCircuit(inputs, update) {
  const [{ Noir }, { Barretenberg, UltraHonkBackend }, { default: circuit }] =
    await Promise.all([
      import("@noir-lang/noir_js"),
      import("@aztec/bb.js"),
      import("../../crypto-lib/pkg/circuit.json"),
    ]);
  update("Executing circuit");
  const { witness } = await new Noir(circuit).execute(inputs);
  update("Generating zero-knowledge proof");
  prover ||= Barretenberg.new({
    backend: BackendType.WasmWorker,
    threads: 1,
  }).then((api) => new UltraHonkBackend(circuit.bytecode, api));
  const backend = await prover;
  const proof = await backend.generateProof(witness, { verifierTarget: "evm" });
  update("Verifying proof locally");
  if (!(await backend.verifyProof(proof, { verifierTarget: "evm" })))
    throw new Error("PROOF_VERIFICATION_FAILED");
  return { proof: Array.from(proof.proof), publicInputs: proof.publicInputs };
}
