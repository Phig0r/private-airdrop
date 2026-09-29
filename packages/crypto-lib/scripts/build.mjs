import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const windows = process.platform === "win32";
function run(command, args) {
  const result = spawnSync(
    windows ? "wsl" : command,
    windows
      ? [
          "--exec",
          "sh",
          "-c",
          'export PATH="$HOME/.cargo/bin:$HOME/.nargo/bin:$PATH"; exec "$@"',
          "crypto-build",
          command,
          ...args,
        ]
      : args,
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
// WSL/native Rust tools stay outside the application; only generated WASM ships.
const cargo = "cargo";
const bindgen = "wasm-bindgen";
run(cargo, [
  "build",
  "--manifest-path",
  "packages/crypto-lib/Cargo.toml",
  "--lib",
  "--release",
  "--target",
  "wasm32-unknown-unknown",
]);
run(bindgen, [
  "packages/crypto-lib/target/wasm32-unknown-unknown/release/crypto_lib.wasm",
  "--target",
  "web",
  "--out-dir",
  "packages/crypto-lib/pkg",
]);

const project = new URL("../target/circuit/", import.meta.url);
mkdirSync(new URL("src/", project), { recursive: true });
cpSync(
  new URL("../../circuits/src/", import.meta.url),
  new URL("src/", project),
  { recursive: true },
);
copyFileSync(
  new URL("../../circuits/Nargo.toml", import.meta.url),
  new URL("Nargo.toml", project),
);
run("nargo", [
  "compile",
  "--program-dir",
  "packages/crypto-lib/target/circuit",
]);
copyFileSync(
  new URL("target/circuits.json", project),
  new URL("../pkg/circuit.json", import.meta.url),
);
