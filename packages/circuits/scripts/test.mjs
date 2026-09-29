import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
function run(command, args) {
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? "wsl" : command,
    windows
      ? [
          "--exec",
          "sh",
          "-c",
          'export PATH="$HOME/.cargo/bin:$HOME/.nargo/bin:$PATH"; exec "$@"',
          "circuit-test",
          command,
          ...args,
        ]
      : args,
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
// Rust emits fixtures using the same helpers shipped as WASM. Noir runs the tests.
run("cargo", [
  "run",
  "--manifest-path",
  "packages/crypto-lib/Cargo.toml",
  "--example",
  "noir_fixtures",
  "--locked",
]);
run("nargo", [
  "test",
  "--program-dir",
  "packages/circuits",
  ...process.argv.slice(2),
]);
