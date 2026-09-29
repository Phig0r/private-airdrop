import { Wallet, getAddress, isHexString } from "ethers";
import { field } from "./issuer.js";

// Only this server reads the key. The browser sends a proof and public inputs.
export function createRelayer(contract, privateKey) {
  if (/^[0-9a-fA-F]{64}$/.test(privateKey || "")) privateKey = `0x${privateKey}`;
  if (!isHexString(privateKey, 32)) throw new Error("Set RELAYER_PRIVATE_KEY in the server .env.");
  const wallet = new Wallet(privateKey, contract.runner);
  const writer = contract.connect(wallet);
  let queue = Promise.resolve();
  return {
    address: wallet.address,
    async claim(id, body) {
      if (Object.keys(body).sort().join(",") !== "nullifierHash,proof,recipient,tierKey" ||
          !isHexString(body.proof) || body.proof.length > 100000 || body.proof.length < 66)
        throw { status: 400, code: "INVALID_CLAIM" };
      const tier = field(body.tierKey), nullifier = field(body.nullifierHash);
      let recipient;
      try { recipient = getAddress(body.recipient); } catch { throw { status: 400, code: "INVALID_RECIPIENT" }; }
      if (BigInt(recipient) === 0n) throw { status: 400, code: "INVALID_RECIPIENT" };
      // One pending submission avoids nonce races and duplicate gas spending.
      const result = queue.then(async () => {
        if ((await contract.relayer()).toLowerCase() !== wallet.address.toLowerCase())
          throw { status: 503, code: "RELAYER_NOT_AUTHORIZED" };
        const args = [id, body.proof, tier, nullifier, recipient];
        // This runs the real verifier and all payout checks without spending gas.
        try { await writer.claim.staticCall(...args); }
        catch { throw { status: 422, code: "CLAIM_REJECTED" }; }
        const tx = await writer.claim(...args);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) throw { status: 503, code: "TRANSACTION_FAILED" };
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== contract.target.toLowerCase()) continue;
          try {
            const event = contract.interface.parseLog(log);
            if (event?.name === "Claimed") return { hash: receipt.hash, amountWei: event.args.amount.toString(), recipient: event.args.recipient };
          } catch { /* Another contract's event. */ }
        }
        throw { status: 503, code: "CLAIM_EVENT_MISSING" };
      });
      queue = result.catch(() => {});
      return result;
    },
  };
}
