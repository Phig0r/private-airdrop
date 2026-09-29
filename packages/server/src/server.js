import { createServer } from "node:http";
import { field } from "./issuer.js";

function respond(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}
async function readBody(request) {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json")
    throw { status: 415, code: "JSON_REQUIRED" };
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 131072) throw { status: 413, code: "BODY_TOO_LARGE" };
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch { throw { status: 400, code: "INVALID_JSON" }; }
}

export function createParticipantServer(db, contract, issuer, scope, relayer) {
  const queues = new Map();
  // Registration and tree snapshots share a lock in this single server process.
  async function exclusive(id, action) {
    const result = (queues.get(id) || Promise.resolve()).then(action);
    const tail = result.catch(() => {});
    queues.set(id, tail);
    try { return await result; }
    finally { if (queues.get(id) === tail) queues.delete(id); }
  }
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const match = /^\/api\/airdrops\/([1-9][0-9]{0,19})\/(participants|status|request-tier|save-tiers|load-tiers|prepare-tree|claim)$/.exec(pathname);
      if (!match) return respond(response, 404, { error: "NOT_FOUND" });
      const [, id, action] = match;
      const collection = db.collection(`leaves_${scope}_${id}`);
      if (request.method === "GET" && action === "status") {
        await contract.getAirdrop(id);
        return respond(response, 200, { ...await issuer.status(id), count: await collection.countDocuments() });
      }
      if (request.method !== "POST") return respond(response, 405, { error: "METHOD_NOT_ALLOWED" });
      const body = await readBody(request);
      if (action === "claim") return respond(response, 200, await relayer.claim(id, body));
      const result = await exclusive(id, async () => {
        if (action === "participants") {
          if (Object.keys(body).length !== 1) throw { status: 400, code: "INVALID_LEAF_HASH" };
          const leaf = field(body.leafHash);
          const drop = await contract.getAirdrop(id);
          if (Number(drop.phase) !== 0 || drop.paused) throw { status: 409, code: "REGISTRATION_CLOSED" };
          await issuer.assertOpen(id);
          if (await collection.findOne({ _id: leaf })) return { leafHash: leaf };
          if (await collection.countDocuments() >= 256) throw { status: 409, code: "TREE_FULL" };
          await collection.insertOne({ _id: leaf });
          return { leafHash: leaf };
        }
        if (action === "prepare-tree") {
          if (!await collection.countDocuments()) throw { status: 409, code: "NO_PARTICIPANTS" };
          await issuer.handle(id, action, body);
          const leaves = await collection.find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray();
          return { leafHashes: leaves.map(leaf => leaf._id) };
        }
        return issuer.handle(id, action, body);
      });
      respond(response, 200, result);
    } catch (error) {
      respond(response, error.status || 503, { error: error.status ? error.code : "SERVICE_UNAVAILABLE" });
    }
  });
}
