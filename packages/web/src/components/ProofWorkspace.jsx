import { chainId, diamondAddress } from "../chain";
import { useState, useMemo } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Fingerprint,
  LockKeyhole,
  Globe,
  PenLine,
  Upload,
} from "lucide-react";
import { acceptsAddress, acceptsField, validField } from "../inputRules";
import { Button, ExpandingInput, Field, HashValue, SecretField } from "./ui";
import {
  downloadJson,
  isAddress,
  proofService,
} from "../services";

export default function ProofWorkspace({
  drop,
  registration,
  wallet,
  busy,
  run,
  proof,
  setProof,
  recipient,
  setRecipient,
  claim,
}) {
  const [step, setStep] = useState(0);
  const [secret, setSecret] = useState("");
  const [seed, setSeed] = useState("");
  const [tierKey, setTierKey] = useState("");
  const [tree, setTree] = useState(null);
  const [path, setPath] = useState(null);
  const [signed, setSigned] = useState(null);
  const invalidate = () => {
    setProof(null);
    setPath(null);
    setSigned(null);
  };
  const load = (data) => {
    if (
      data.version !== 2 ||
      data.encoding !== "utf8-keccak256-mod-bn254-v1" ||
      data.airdrop !== drop.key ||
      data.chainId !== chainId || data.contract?.toLowerCase() !== diamondAddress.toLowerCase() ||
      data.address?.toLowerCase() !== wallet.address.toLowerCase() ||
      typeof data.secret !== "string" ||
      typeof data.nullifierSeed !== "string" ||
      !validField(data.tierKey) ||
      !validField(data.nullifierSeed)
    )
      throw new Error("Use the registration JSON for this airdrop and wallet.");
    invalidate();
    setSecret(data.secret);
    setSeed(data.nullifierSeed);
    setTierKey(data.tierKey);
  };
  const locate = () =>
    run("Locating your registered leaf", async () => {
      setPath(null);
      setProof(null);
      setPath(
        proofService.locate(tree, drop, registration, secret, seed, tierKey),
      );
    });
  const generate = () =>
    run("Preparing proof", async (update) => {
      setProof(null);
      setProof(
        await proofService.generate(
          drop,
          registration,
          recipient,
          wallet,
          update,
          { tree, secret, seed, tierKey, signed },
        ),
      );
    });
  const sameRecipient =
    !!recipient && recipient.toLowerCase() === wallet.address.toLowerCase();
  const validRecipient =
    isAddress(recipient) &&
    recipient.toLowerCase() !== wallet.address.toLowerCase();
  const prepared = useMemo(
    () =>
      path && signed
        ? proofService.prepare(drop, registration, recipient, {
            tree,
            secret,
            seed,
            tierKey,
            signed,
          })
        : null,
    [path, signed, drop, registration, recipient, tree, secret, seed, tierKey],
  );
  const publicInputs = prepared
    ? {
        tier_key: prepared.tier_key,
        nullifier_hash: prepared.nullifier_hash,
        merkle_root: prepared.merkle_root,
        recipient: prepared.recipient,
      }
    : null;
  return (
    <div className="proof-workspace">
      <nav className="proof-navigation" aria-label="Proof preparation steps">
        {["Registration inputs", "Tree & membership", "Sign & prove"].map(
          (name, index) => (
            <button
              key={name}
              type="button"
              disabled={busy || (index === 2 && !path)}
              className={step === index ? "selected" : ""}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {name}
            </button>
          ),
        )}
      </nav>
      {step === 0 && (
        <section className="proof-step">
          <div className="proof-section-heading">
            <h2>Your registration inputs</h2>
            <label
              className={`button secondary file-button ${busy ? "disabled" : ""}`}
            >
              <Upload size={14} />
              Import registration JSON
              <input
                aria-label="Import registration JSON"
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (file)
                    run("Reading registration JSON", async () => {
                      if (file.size > 100000)
                        throw new Error("Registration file is too large.");
                      load(JSON.parse(await file.text()));
                    });
                }}
              />
            </label>
          </div>
          <div className="registration-private">
            <SecretField
              id="proof-secret"
              label="Secret phrase"
              value={secret}
              autoComplete="off"
              disabled={busy}
              onChange={(e) => {
                invalidate();
                setSecret(e.target.value);
              }}
            />
            <SecretField
              id="proof-seed"
              label="Nullifier seed"
              value={seed}
              autoComplete="off"
              disabled={busy}
              onChange={(e) => {
                invalidate();
                if (!acceptsField(e.target.value)) return;
                setSeed(e.target.value);
              }}
            />
          </div>
          <Field
            label="Registered tier key"
            value={tierKey}
            placeholder="From your registration JSON"
            disabled={busy}
            onChange={(e) => {
              invalidate();
              if (!acceptsField(e.target.value)) return;
              setTierKey(e.target.value);
            }}
          />
          <div className="proof-step-footer">
            <span>Use the values saved when you registered.</span>
            <Button
              disabled={
                busy ||
                !secret.trim() ||
                !seed.trim() ||
                !validField(tierKey) ||
                !validField(seed)
              }
              onClick={() => setStep(1)}
            >
              Continue to tree
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="proof-step">
          <div className="proof-section-heading">
            <h2>Find your Merkle path</h2>
            <label className={`button secondary file-button ${busy ? "disabled" : ""}`}>
              <Upload size={14} />
              {tree ? "Replace tree JSON" : "Upload tree JSON"}
              <input
                aria-label="Upload tree JSON"
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (file) run("Reading Merkle tree JSON", async () => {
                    invalidate();
                    setTree(null);
                    if (file.size > 200000)
                      throw new Error("Tree file is too large.");
                    setTree(proofService.importTree(JSON.parse(await file.text()), drop));
                  });
                }}
              />
            </label>
          </div>
          {!tree ? (
            <p className="setup-placeholder">
              Upload the tree JSON provided by the admin, then locate your leaf.
            </p>
          ) : (
            <>
              <div className="tree-fetch-summary">
                <Check size={16} />
                <span>Tree imported</span>
                <span>
                  {tree.leaves.length} leaves · {tree.depth} levels
                </span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => downloadJson(tree, "airdrop-merkle-tree.json")}
                >
                  <Download size={14} />
                  JSON
                </button>
              </div>
              <HashValue label="Merkle root" value={tree.root} />
              <Button
                secondary
                disabled={busy || !secret || !seed || !tierKey}
                onClick={locate}
              >
                Find my Merkle path
              </Button>
              {path && (
                <>
                  <div className="path-summary">
                    <Check size={15} />
                    Leaf found<span>Index {path.leaf_index} · 8 siblings</span>
                  </div>
                  <details className="witness-details">
                    <summary>View Merkle path</summary>
                    {path.merkle_path.map((value, index) => (
                      <HashValue
                        key={index}
                        label={`Sibling ${index + 1}`}
                        value={value}
                      />
                    ))}
                  </details>
                </>
              )}
            </>
          )}
          <div className="proof-step-footer">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Back to inputs
            </button>
            <Button disabled={busy || !path} onClick={() => setStep(2)}>
              Continue to signing
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="proof-step">
          <div className="proof-section-heading">
            <h2>Authorize & generate proof</h2>
            <span className="muted small">
              Signing wallet: {wallet.address.slice(0, 8)}…
              {wallet.address.slice(-6)}
            </span>
          </div>
          <Field
            error={
              sameRecipient
                ? "Recipient must be different from the connected wallet."
                : recipient && !isAddress(recipient)
                  ? "Enter a valid recipient wallet address."
                  : undefined
            }
            label="Recipient address"
            value={recipient}
            placeholder="A different wallet to receive your ETH"
            disabled={busy}
            onChange={(e) => {
              if (!acceptsAddress(e.target.value)) return;
              setRecipient(e.target.value);
              setSigned(null);
              setProof(null);
            }}
          />
          <div className="sign-request">
            <div>
              <strong>Sign recipient + nullifier seed</strong>
              <span>
                EIP-191 signature · signing public key recovered from approval
              </span>
            </div>
            <Button
              secondary
              disabled={busy || !validRecipient || !seed}
              onClick={() =>
                run("Confirm signature in MetaMask", async () => {
                  setProof(null);
                  setSigned(null);
                  setSigned(await proofService.sign(wallet, recipient, seed));
                })
              }
            >
              <PenLine size={15} />
              {signed ? "Sign again" : "Sign & recover public key"}
            </Button>
          </div>
          {signed && (
            <div className="circuit-input-panels">
              <section className="circuit-input-panel private-input-panel">
                <div className="circuit-input-heading">
                  <h3>
                    <LockKeyhole size={15} />
                    Private inputs
                  </h3>
                  <span>Witness only</span>
                </div>
                <div className="circuit-fields">
                  <Field label="Public key X" note="pub_key_x / 32 bytes">
                    <ExpandingInput
                      label="Public key X"
                      value={signed.pub_key_x.join(", ")}
                    />
                  </Field>
                  <Field label="Public key Y" note="pub_key_y / 32 bytes">
                    <ExpandingInput
                      label="Public key Y"
                      value={signed.pub_key_y.join(", ")}
                    />
                  </Field>
                  <Field label="Signature" note="signature / 64 bytes">
                    <ExpandingInput
                      label="Signature"
                      value={signed.signature.join(", ")}
                    />
                  </Field>
                  <Field
                    label="Secret field"
                    note="secret"
                    value={prepared.secret}
                    readOnly
                  />
                  <Field
                    label="Nullifier seed field"
                    note="nullifier_seed"
                    value={prepared.nullifier_seed}
                    readOnly
                  />
                  <Field
                    label="Leaf index"
                    note="leaf_index"
                    value={path.leaf_index}
                    readOnly
                  />
                  <details className="merkle-input-fields">
                    <summary>Merkle path / 8 fields</summary>
                    {path.merkle_path.map((value, index) => (
                      <Field
                        key={index}
                        label={`Merkle sibling ${index + 1}`}
                        value={BigInt(value).toString()}
                        readOnly
                      />
                    ))}
                  </details>
                </div>
              </section>
              <section className="circuit-input-panel public-input-panel">
                <div className="circuit-input-heading">
                  <h3>
                    <Globe size={15} />
                    Public inputs
                  </h3>
                  <span>On-chain verification</span>
                </div>
                <div className="circuit-fields">
                  {Object.entries(publicInputs).map(([name, value]) => (
                    <Field
                      key={name}
                      label={
                        {
                          tier_key: "Tier key",
                          nullifier_hash: "Nullifier hash",
                          merkle_root: "Merkle root",
                          recipient: "Recipient field",
                        }[name]
                      }
                      note={name}
                      value={value}
                      readOnly
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
          {proof && (
            <>
              <div className="simple-proof-ready">
                <Check size={15} />
                Proof ready
              </div>
              <details className="witness-details">
                <summary>Generated proof · locally verified</summary>
                <pre className="proof-json">
                  {JSON.stringify(proof, null, 2)}
                </pre>
              </details>
            </>
          )}
          <div className="simple-claim-actions">
            <Button
              secondary
              disabled={busy || !signed || !path || !validRecipient || !!proof}
              onClick={generate}
            >
              <Fingerprint size={15} />
              Generate ZK proof
            </Button>
            <Button disabled={busy || !proof} onClick={claim}>
              Claim reward
              <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
