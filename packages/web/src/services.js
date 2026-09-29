import { cryptoHelpers as c, randomField, proveCircuit } from "./crypto";
import { participantsApi } from "./participants";
import { blockchainService, walletService, issuerRequest, readContract, signCircuitMessage, chainId, diamondAddress } from "./chain";
export { blockchainService, walletService } from "./chain";
export { units, fromUnits } from "./amounts";
import { units, fromUnits } from "./amounts";
export const key = () => crypto.randomUUID();
export const tierContext = drop => drop.context;
export function registrationNonce(address, secret, seed) {
  return c.nullifierHash(c.leafFromPhrase(address, secret, seed, "0"));
}
export function registrationInfo(drop, input) {
  const leaf = c.leafFromPhrase(
    input.address,
    input.secret,
    input.seed,
    input.childKey,
  );
  return {
    version: 2,
    encoding: "utf8-keccak256-mod-bn254-v1",
    airdrop: drop.key,
    chainId,
    contract: diamondAddress.toLowerCase(),
    tierContext: tierContext(drop),
    address: leaf.address,
    secret: input.secret,
    nullifierSeed: leaf.nullifier_seed,
    tierKey: leaf.tier_key,
    leaf,
    leafHash: c.hashLeaf(leaf),
    nullifierHash: c.nullifierHash(leaf),
  };
}
function coreTree(tree) {
  return { count: tree.count, levels: tree.levels };
}
function treeFromRecords(records) {
  const tree = c.buildTree(records.map((record) => record.leafHash));
  return {
    ...tree,
    root: tree.levels[8][0],
    depth: 8,
    participants: tree.count,
    leaves: tree.levels[0].map((hash, index) => ({
      index,
      hash,
      generated: index >= tree.count,
    })),
  };
}
export function downloadJson(data, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const statusTone = (item) =>
  item.phase === "ENDED"
    ? "ended"
    : item.status === "PAUSED"
      ? "paused"
      : item.status === "COMPLETED"
        ? "completed"
        : "good";
export const phaseLabel = (item) =>
  item.phase === "INITIAL"
    ? "PHASE 1 · REGISTRATION"
    : item.phase === "CLAIM"
      ? "PHASE 2 · CLAIM"
      : "ENDED";
export const short = (value) =>
  value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "Not generated";
export const isAddress = (value) =>
  /^0x[\da-fA-F]{40}$/i.test(value) && !/^0x0{40}$/.test(value);
export const displayAmount = (value) => {
  const [whole, fraction] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
};
export const remaining = (drop) =>
  drop.phase === "ENDED" ? "0" : fromUnits(
    units(drop.maxBudget) -
      (drop.totalClaimed === "0" ? 0n : units(drop.totalClaimed)),
  );
export const newTier = () => ({
  key: key(),
  name: "",
  value: "",
  keyType: "bn254",
  masterKey: null,
});
export function walletGuard(wallet) {
  if (!wallet) throw new Error("Connect your wallet first.");
}
export function phaseBlock(drop, phase) {
  if (!drop) return "Select an airdrop.";
  if (drop.phase === "ENDED") return "This airdrop has ended.";
  if (drop.status === "COMPLETED") return "This airdrop is completed.";
  if (drop.status === "PAUSED") return "This airdrop is paused.";
  if (phase === "INITIAL" && drop.registrationClosed) return "Registration is closed.";
  if (drop.phase !== phase)
    return phase === "INITIAL"
      ? "Registration is closed."
      : "The claim phase has not started.";
  return "";
}
function assertPhase(drop, phase) {
  const message = phaseBlock(drop, phase);
  if (message) throw new Error(message);
}
export function validateSetup(name, budget, tiers = []) {
  const errors = {};
  if (!name.trim() || new TextEncoder().encode(name.trim()).length > 60)
    errors.name = "Enter an airdrop name (up to 60 UTF-8 bytes).";
  let max;
  try {
    max = units(budget);
  } catch (error) {
    errors.budget = error.message;
  }
  const names = new Set();
  for (const tier of tiers) {
    if (new TextEncoder().encode(tier.name.trim()).length > 40) errors[tier.key] = "Enter a tier name (up to 40 UTF-8 bytes).";
    else if (tier.name.trim() && names.has(tier.name.trim().toLowerCase()))
      errors[tier.key] = "Tier names must be unique.";
    names.add(tier.name.trim().toLowerCase());
    try {
      if (max && units(tier.value) > max)
        errors[tier.key] = "The reward cannot exceed the budget.";
      else units(tier.value);
    } catch (error) {
      errors[tier.key] = error.message;
    }
    if (!tier.keyType) errors[tier.key] ||= "Select a key type.";
    if (!tier.masterKey)
      errors[tier.key] ||= "Generate this tier’s master key.";
  }
  return errors;
}
export const tierService = {
  async generate() { return randomField(); },
  async request(drop, address, nullifierHash, wallet) {
    walletGuard(wallet); assertPhase(drop, "INITIAL");
    if (address.toLowerCase() !== wallet.address.toLowerCase()) throw new Error("Use the connected wallet address.");
    return issuerRequest(drop, "request-tier", { nullifierHash: c.normalizeField(nullifierHash) }, wallet);
  },
  save: (drop, tiers, wallet) => issuerRequest(drop, "save-tiers", {
    tiers: tiers.map(t => ({ name: t.name.trim(), reward: units(t.value).toString(), masterKey: c.normalizeField(t.masterKey) })),
  }, wallet),
  async load(drop, wallet) {
    if (drop.phase !== "INITIAL") return drop.rewardTiers;
    const { tiers } = await issuerRequest(drop, "load-tiers", {}, wallet);
    return tiers.map((t, i) => ({ key: String(i), name: t.name, masterKey: t.masterKey, value: fromUnits(t.reward), amountWei: t.reward }));
  },
};
const registrationKey = (drop, address) => `registration:${chainId}:${diamondAddress.toLowerCase()}:${drop.key}:${address.toLowerCase()}`;
export const participantService = {
  async registration(drop, address) {
    if (!address) return null;
    try { return JSON.parse(localStorage.getItem(registrationKey(drop, address))); } catch { return null; }
  },
  async register(drop, input, wallet) {
    walletGuard(wallet); assertPhase(drop, "INITIAL");
    if (input.address.toLowerCase() !== wallet.address.toLowerCase()) throw new Error("Use the connected wallet address.");
    const backup = registrationInfo(drop, input);
    await participantsApi.save(drop.key, backup.leafHash);
    const record = { address: input.address, leafHash: backup.leafHash };
    // A local receipt is only a convenience. The downloaded backup is the recovery file.
    try { localStorage.setItem(registrationKey(drop, input.address), JSON.stringify(record)); } catch { /* Storage may be disabled. */ }
    return record;
  },
  async fetch(drop, wallet) {
    const { leafHashes } = await issuerRequest(drop, "prepare-tree", {}, wallet);
    return leafHashes.map(leafHash => ({ leafHash: c.normalizeField(leafHash) }));
  },
};
export const merkleService = {
  async build(records) {
    if (!records.length) throw new Error("NO_PARTICIPANTS");
    return treeFromRecords(records);
  },
};
export const proofService = {
  importTree(data, drop) {
    if (!data || !Array.isArray(data.levels)) throw new Error("INVALID_TREE");
    const root = c.validateTree(coreTree(data));
    if (root !== c.normalizeField(drop.merkleRoot) ||
        root !== c.normalizeField(data.root)) throw new Error("INVALID_TREE");
    // Use validated levels, not untrusted display metadata from the file.
    return {
      count: data.count,
      levels: data.levels,
      root,
      depth: 8,
      participants: data.count,
      leaves: data.levels[0].map((hash, index) => ({
        index, hash, generated: index >= data.count,
      })),
    };
  },
  locate(tree, drop, record, secret, seed, tierKey) {
    const root = c.validateTree(coreTree(tree));
    if (
      root !== c.normalizeField(drop.merkleRoot) ||
      root !== c.normalizeField(tree.root)
    )
      throw new Error("INVALID_TREE");
    const leaf = c.leafFromPhrase(record.address, secret, seed, tierKey);
    const leafHash = c.hashLeaf(leaf);
    if (record.leafHash && leafHash !== record.leafHash) throw new Error("LEAF_NOT_FOUND");
    return {
      ...c.findPath(coreTree(tree), leafHash),
      leaf: leafHash,
      account: leaf,
    };
  },
  async sign(wallet, recipient, seed) {
    walletGuard(wallet);
    if (
      !isAddress(recipient) ||
      recipient.toLowerCase() === wallet.address.toLowerCase()
    )
      throw new Error("INVALID_RECIPIENT");
    const normalizedSeed = c.normalizeField(seed);
    const message = c.signingMessage(recipient, normalizedSeed);
    const signature = await signCircuitMessage(wallet, message);
    const publicKey = c.recoverPublicKey(recipient, normalizedSeed, signature);
    const bytes = (hex) =>
      Array.from(hex.replace(/^0x/, "").match(/../g), (n) => parseInt(n, 16));
    const pk = bytes(publicKey);
    return {
      pub_key_x: pk.slice(1, 33),
      pub_key_y: pk.slice(33),
      signature: bytes(signature).slice(0, 64),
      signatureHex: signature,
      publicKey,
      message,
      recipient: recipient.toLowerCase(),
      seed: normalizedSeed,
      wallet: wallet.address,
    };
  },
  prepare(drop, record, recipient, { tree, secret, seed, tierKey, signed }) {
    const path = this.locate(tree, drop, record, secret, seed, tierKey);
    return c.circuitInputs(
      path.account,
      coreTree(tree),
      path.leaf_index,
      recipient,
      signed.publicKey,
      signed.signatureHex,
    );
  },
  async generate(drop, record, recipient, wallet, update, inputs) {
    walletGuard(wallet);
    assertPhase(drop, "CLAIM");
    if (!record || record.address.toLowerCase() !== wallet.address.toLowerCase())
      throw new Error("LEAF_NOT_FOUND");
    const prepared = this.prepare(drop, record, recipient, inputs);
    if (await readContract().isClaimed(drop.key, prepared.nullifier_hash))
      throw new Error("This registration has already claimed its reward.");
    const result = await proveCircuit(prepared, update);
    const expected = [prepared.tier_key, prepared.nullifier_hash, prepared.merkle_root, prepared.recipient];
    if (result.publicInputs.length !== 4 || result.publicInputs.some((value, i) => BigInt(value) !== BigInt(expected[i])))
      throw new Error("CIRCUIT_PUBLIC_INPUT_MISMATCH");
    return {
      root: prepared.merkle_root,
      recipient: recipient.toLowerCase(),
      nullifierHash: prepared.nullifier_hash,
      tierKey: prepared.tier_key,
      wallet: wallet.address,
      publicInputs: {
        tier_key: prepared.tier_key,
        nullifier_hash: prepared.nullifier_hash,
        merkle_root: prepared.merkle_root,
        recipient: prepared.recipient,
      },
      proof: result.proof,
      verified: true,
    };
  },
};
export function exportTree(tree) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" }),
  );
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: "airdrop-merkle-tree.json",
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
