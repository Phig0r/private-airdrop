import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, getBytes, hexlify, keccak256, toBeHex, toUtf8Bytes } from "ethers";
import abi from "../../contracts/abi/Airdrop.json";
import faucetAbi from "../../contracts/abi/DemoFaucet.json";
import { fromUnits, units } from "./amounts";

export const chainId = 11155111;
export const diamondAddress = import.meta.env.VITE_DIAMOND_ADDRESS || "";
const networkName = "Sepolia";
let reader;
export function readContract() {
  if (!/^0x[0-9a-fA-F]{40}$/.test(diamondAddress) || diamondAddress === ZeroAddress)
    throw new Error("Set VITE_DIAMOND_ADDRESS to the deployed diamond in packages/web/.env.");
  reader ||= new Contract(diamondAddress, abi, new JsonRpcProvider(import.meta.env.VITE_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"));
  return reader;
}
export async function checkDeployment() {
  const contract = readContract();
  if (Number((await contract.runner.getNetwork()).chainId) !== chainId)
    throw new Error("Set VITE_RPC_URL to a Sepolia RPC (11155111).");
  if (await contract.runner.getCode(diamondAddress) === "0x")
    throw new Error("No contract is deployed at VITE_DIAMOND_ADDRESS on Sepolia. Update packages/web/.env and restart the app.");
  try {
    const names = ["isOwner", "superOwner", "airdropCount", "demoAccess"];
    const routes = await Promise.all(names.map(name => contract.facetAddress(contract.interface.getFunction(name).selector)));
    if (routes.some(address => address === ZeroAddress)) throw new Error("Missing route");
    await contract.superOwner();
  } catch (error) {
    if (["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR"].includes(error.code))
      throw new Error("Unable to reach the Sepolia RPC. Check your connection and try again.");
    throw new Error("The configured address is not a compatible Private Airdrop diamond. Use the deployed contract address, not your wallet address, and restart the app.");
  }
  return contract;
}
export async function signer(wallet) {
  if (!window.ethereum) throw new Error("Install MetaMask to connect your wallet.");
  const provider = new BrowserProvider(window.ethereum);
  if (Number((await provider.getNetwork()).chainId) !== chainId) throw new Error(`Switch MetaMask to ${networkName}.`);
  const result = await provider.getSigner();
  if (wallet && (await result.getAddress()).toLowerCase() !== wallet.address.toLowerCase()) throw new Error("The connected account changed. Reconnect your wallet.");
  return result;
}
export const walletService = {
  async addSepolia() {
    if (!window.ethereum) throw new Error("Install MetaMask to add Sepolia.");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toBeHex(chainId) }] });
      return;
    } catch (error) {
      if (Number(error.code) !== 4902) throw error;
    }
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: toBeHex(chainId), chainName: "Sepolia",
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"],
    }] });
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: toBeHex(chainId) }] });
  },
  async connect() {
    if (!window.ethereum) throw new Error("Install MetaMask to connect your wallet.");
    await checkDeployment();
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await walletService.addSepolia();
    return { address: await (await signer()).getAddress(), network: networkName };
  },
};
async function transaction(wallet, method, args, update = () => {}, value) {
  const contract = readContract().connect(await signer(wallet));
  update("Confirm transaction in MetaMask");
  const tx = await contract[method](...args, ...(value === undefined ? [] : [{ value }]));
  update("Waiting for transaction confirmation");
  let receipt;
  try { receipt = await tx.wait(); }
  catch (error) {
    if (error.code === "TRANSACTION_REPLACED" && !error.cancelled) receipt = error.receipt;
    else throw error;
  }
  if (!receipt || receipt.status !== 1) throw new Error("Transaction failed.");
  return receipt;
}
function event(receipt, name) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== diamondAddress.toLowerCase()) continue;
    try { const parsed = readContract().interface.parseLog(log); if (parsed?.name === name) return parsed.args; } catch { /* Other event. */ }
  }
  throw new Error(`Confirmed transaction did not emit ${name}.`);
}
export function mapDrop(id, d) {
  const phase = ["INITIAL", "CLAIM", "ENDED"][Number(d.phase)];
  const tiers = d.tiers.map((t, i) => ({ key: String(i), name: t.name, value: fromUnits(t.reward), amountWei: t.reward.toString(), masterKey: t.masterKey === 0n ? null : t.masterKey.toString() }));
  return { key: String(id), name: d.name, maxBudget: fromUnits(d.budget), totalClaimed: fromUnits(d.claimed), createdAt: new Date(Number(d.createdAt) * 1000).toISOString(), context: d.context.toString(), merkleRoot: d.root === 0n ? null : d.root.toString(), participants: 0, phase, status: phase === "ENDED" ? "ENDED" : d.budget === d.claimed ? "COMPLETED" : d.paused ? "PAUSED" : "ACTIVE", rewardTiers: tiers, publicTierKeys: phase === "INITIAL" ? null : tiers };
}
export const blockchainService = {
  async list() {
    const contract = readContract();
    const provider = contract.runner;
    if (Number((await provider.getNetwork()).chainId) !== chainId) throw new Error("Set VITE_RPC_URL to a Sepolia RPC (11155111).");
    const count = Number(await contract.airdropCount());
    const drops = [];
    for (let first = 1; first <= count; first += 20) {
      drops.push(...await Promise.all(Array.from({ length: Math.min(20, count - first + 1) }, async (_, offset) => {
        const id = first + offset; return mapDrop(id, await contract.getAirdrop(id));
      })));
    }
    return drops;
  },
  async create(wallet, name, budget, update) {
    const receipt = await transaction(wallet, "createAirdrop", [name.trim(), units(budget)], update);
    const id = event(receipt, "AirdropCreated").id.toString();
    return mapDrop(id, await readContract().getAirdrop(id));
  },
  async change(wallet, drop, action, tree, tiers, update) {
    if (action === "start") return transaction(wallet, "startClaimPhase", [drop.key, tree.root,
      tiers.map(t => ({ name: t.name || "", reward: units(t.value), masterKey: t.masterKey }))], update);
    return action === "end" ? transaction(wallet, "endAirdrop", [drop.key], update)
      : transaction(wallet, "setPaused", [drop.key, action === "pause"], update);
  },
  fund: (wallet, amount, update) => transaction(wallet, "fundPool", [], update, units(amount)),
  withdraw: (wallet, recipient, amount, update) => transaction(wallet, "withdraw", [recipient, units(amount)], update),
  setDemoFaucet: (wallet, faucet, enabled, update) => transaction(wallet, "setDemoFaucet", [faucet, enabled], update),
  async requestDemo(wallet) {
    const [address, enabled] = await readContract().demoAccess();
    if (!enabled || address === ZeroAddress) throw new Error("Demo write access is currently closed. You can still use the read-only preview.");
    const faucet = new Contract(address, faucetAbi, await signer(wallet));
    const receipt = await (await faucet.requestRole()).wait();
    if (!receipt || receipt.status !== 1) throw new Error("The demo role request failed.");
  },
  setOwners: (wallet, accounts, enabled, update) => transaction(wallet, "setOwners", [accounts, enabled], update),
  async claim(wallet, drop, proof, update) {
    update("Sending proof to the relayer");
    const response = await fetch(`/api/airdrops/${drop.key}/claim`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof: hexlify(Uint8Array.from(proof.proof)), tierKey: proof.tierKey,
        nullifierHash: proof.nullifierHash, recipient: proof.recipient }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Relayer unavailable.");
    update("Checking the confirmed payment");
    const receipt = await readContract().runner.getTransactionReceipt(data.hash);
    if (!receipt || receipt.status !== 1) throw new Error("Payment has not been confirmed.");
    const paid = event(receipt, "Claimed");
    if (paid.id.toString() !== drop.key || paid.nullifier.toString() !== proof.nullifierHash ||
        paid.recipient.toLowerCase() !== proof.recipient.toLowerCase()) throw new Error("Claim receipt does not match this proof.");
    return { hash: receipt.hash, amount: fromUnits(paid.amount), recipient: paid.recipient };
  },
};
export async function issuerRequest(drop, action, payload, wallet) {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const digest = keccak256(toUtf8Bytes(JSON.stringify(payload)));
  const message = `Private Airdrop\nChain: ${chainId}\nContract: ${diamondAddress.toLowerCase()}\nAction: ${action}\nAirdrop: ${drop.key}\nPayload: ${digest}\nExpires: ${expires}`;
  const signature = await (await signer(wallet)).signMessage(message);
  const response = await fetch(`/api/airdrops/${drop.key}/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet.address, expires, signature, payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Tier server unavailable.");
  return data;
}
export async function signCircuitMessage(wallet, message) {
  // Sign the 32 raw bytes, never the printable hex string.
  return (await signer(wallet)).signMessage(getBytes(message));
}
