import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../", import.meta.url));

// Use the installed Linux tools on Windows as well as on Linux.
export function run(command, args, cwd = root) {
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? "wsl" : command, windows ? [
    "--exec", "sh", "-c",
    'export PATH="$HOME/.foundry/bin:$HOME/.nargo/bin:$PATH"; exec "$@"',
    "airdrop-build", command, ...args,
  ] : args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed`);
}
