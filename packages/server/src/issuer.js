import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { keccak256, toBeHex, verifyMessage } from "ethers";

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export function field(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,76})$/.test(value) || BigInt(value) >= FIELD)
    throw { status: 400, code: "INVALID_FIELD" };
  return value;
}
const bytes = value => Buffer.from(toBeHex(BigInt(value), 32).slice(2), "hex");
export function deriveTierKey(master, context, nullifier) {
  return (BigInt("0x" + createHmac("sha256", bytes(master))
    .update("private-airdrop/tier-key/v1").update(bytes(context)).update(bytes(nullifier))
    .digest("hex")) % FIELD).toString();
}

// Store tier settings and registration status, never participant identities or inputs.
export function createIssuer(contract, chainId, directory) {
  const vault = resolve(directory);
  const scope = `${chainId}-${contract.target.toLowerCase()}`;
  const path = id => join(vault, `${scope}-${id}.json`);
  async function authenticate(body, action, id) {
    const { address, expires, signature, payload } = body;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address || "") || !payload || typeof payload !== "object" || Array.isArray(payload))
      throw { status: 400, code: "INVALID_AUTHORIZATION" };
    const fields = Object.keys(payload);
    const expected = action === "request-tier" ? "nullifierHash" : action === "save-tiers" ? "tiers" : null;
    if (expected ? fields.length !== 1 || fields[0] !== expected : fields.length !== 0)
      throw { status: 400, code: "INVALID_PAYLOAD" };
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(expires) || expires < now || expires > now + 600 || typeof signature !== "string")
      throw { status: 401, code: "EXPIRED_AUTHORIZATION" };
    const digest = keccak256(Buffer.from(JSON.stringify(payload)));
    const message = `Private Airdrop\nChain: ${chainId}\nContract: ${contract.target.toLowerCase()}\nAction: ${action}\nAirdrop: ${id}\nPayload: ${digest}\nExpires: ${expires}`;
    let signer;
    try { signer = verifyMessage(message, signature); } catch { throw { status: 401, code: "INVALID_SIGNATURE" }; }
    if (signer.toLowerCase() !== address?.toLowerCase()) throw { status: 401, code: "INVALID_SIGNATURE" };
    return signer;
  }
  async function load(id) {
    try { return JSON.parse(await readFile(path(id), "utf8")); }
    catch { throw { status: 409, code: "ISSUER_NOT_CONFIGURED" }; }
  }
  async function save(id, config) {
    await mkdir(vault, { recursive: true, mode: 0o700 });
    const temporary = `${path(id)}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(config), { mode: 0o600 });
    await rename(temporary, path(id));
  }
  function validateTiers(tiers, budget) {
    if (!Array.isArray(tiers) || !tiers.length || tiers.length > 32) throw { status: 400, code: "INVALID_TIERS" };
    const seen = new Set();
    return tiers.map(tier => {
      const masterKey = field(tier.masterKey);
      if (typeof tier.name !== "string" || Buffer.byteLength(tier.name) > 40 || masterKey === "0" || seen.has(masterKey) ||
          typeof tier.reward !== "string" || !/^[1-9][0-9]{0,77}$/.test(tier.reward) || BigInt(tier.reward) > budget)
        throw { status: 400, code: "INVALID_TIERS" };
      seen.add(masterKey);
      return { name: tier.name, reward: tier.reward, masterKey };
    });
  }
  return {
    async status(id) {
      try { const config = await load(id); return { configured: true, closed: config.closed }; }
      catch (error) { if (error.code === "ISSUER_NOT_CONFIGURED") return { configured: false, closed: false }; throw error; }
    },
    async assertOpen(id) {
      const config = await load(id);
      if (config.closed) throw { status: 409, code: "REGISTRATION_CLOSED" };
    },
    async handle(id, action, body) {
      const address = await authenticate(body, action, id);
      const drop = await contract.getAirdrop(id);
      if (action !== "request-tier") {
        if (!await contract.isOwner(address)) throw { status: 403, code: "OWNER_ONLY" };
        if (action === "save-tiers") {
          if (Number(drop.phase) !== 0 || drop.paused) throw { status: 409, code: "REGISTRATION_CLOSED" };
          const tiers = validateTiers(body.payload.tiers, drop.budget);
          const current = await this.status(id);
          if (current.configured) {
            if (JSON.stringify((await load(id)).tiers) !== JSON.stringify(tiers))
              throw { status: 409, code: "TIERS_ALREADY_CONFIGURED" };
          } else await save(id, { tiers, closed: false });
          return { saved: true };
        }
        const config = await load(id);
        if (action === "prepare-tree") {
          if (Number(drop.phase) !== 0 || drop.paused) throw { status: 409, code: "REGISTRATION_CLOSED" };
          config.closed = true;
          await save(id, config);
          return { closed: true };
        }
        return { tiers: config.tiers };
      }
      if (Number(drop.phase) !== 0 || drop.paused) throw { status: 409, code: "REGISTRATION_CLOSED" };
      const nullifier = field(body.payload.nullifierHash);
      const config = await load(id);
      if (config.closed) throw { status: 409, code: "REGISTRATION_CLOSED" };
      const choice = createHmac("sha256", bytes(config.tiers[0].masterKey)).update(scope).update(id).update(address.toLowerCase()).digest("hex");
      const index = Number(BigInt("0x" + choice) % BigInt(config.tiers.length));
      return { childKey: deriveTierKey(config.tiers[index].masterKey, drop.context, nullifier) };
    },
  };
}
