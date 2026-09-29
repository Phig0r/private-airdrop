import { acceptsAddress, acceptsField, validField } from "../inputRules";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Fingerprint,
  Download,
  KeyRound,
  LockKeyhole,
} from "lucide-react";
import {
  Badge,
  Button,
  Field,
  HashValue,
  Notice,
  Progress,
  SecretField,
} from "../components/ui";
import AirdropBrowser from "../components/AirdropBrowser";
import ProofWorkspace from "../components/ProofWorkspace";
import {
  registrationInfo,
  registrationNonce,
  downloadJson,
  blockchainService,
  displayAmount,
  isAddress,
  participantService,
  phaseBlock,
  tierService,
  statusTone,
} from "../services";

export default function User({
  wallet,
  connect,
  busy,
  setBusy,
  airdrops,
  refresh,
}) {
  const [selected, setSelected] = useState(null);
  const [address, setAddress] = useState("");
  const [secret, setSecret] = useState("");
  const [seed, setSeed] = useState("");
  const [tier, setTier] = useState("");
  const [childKey, setChildKey] = useState("");
  const [recipient, setRecipient] = useState("");
  const [registration, setRegistration] = useState(null);
  const [proof, setProof] = useState(null);
  const [downloaded, setDownloaded] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const drop = airdrops.find((item) => item.key === selected);
  const walletAddress = wallet?.address;
  useEffect(() => {
    setAddress(walletAddress || "");
    setSecret("");
    setSeed("");
    setTier("");
    setChildKey("");
    setRecipient("");
    setDownloaded(null);
    setProof(null);
    setError("");
    setRegistration(null);
    setReceipt(null);
  }, [selected, walletAddress]);
  useEffect(() => {
    let current = true;
    if (drop && walletAddress) participantService.registration(drop, walletAddress)
      .then(record => { if (current) setRegistration(record || (drop.phase === "CLAIM" ? { address: walletAddress, leafHash: null } : null)); })
      .catch(e => { if (current) setError(e.shortMessage || e.message); });
    return () => { current = false; };
  }, [selected, walletAddress, drop?.phase]);
  useEffect(() => {
    setProof(null);
  }, [drop?.status, drop?.phase]);
  const backupFingerprint = JSON.stringify([
    selected,
    address,
    secret,
    seed,
    tier,
    childKey,
  ]);
  const backupReady = downloaded === backupFingerprint;
  const canDownload =
    !!wallet &&
    isAddress(address) &&
    address.toLowerCase() === wallet.address.toLowerCase() &&
    !!secret.trim() &&
    validField(seed) &&
    !!childKey;
  const downloadRegistration = () =>
    run("Preparing registration JSON", async () => {
      if (!canDownload)
        throw new Error("Complete your registration inputs first.");
      downloadJson(
        registrationInfo(drop, { address, secret, seed, childKey }),
        "airdrop-registration.json",
      );
      setDownloaded(backupFingerprint);
    });
  async function run(label, action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(label);
    try {
      await action(setProgress);
    } catch (e) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  const request = () =>
    run("Requesting tier key", async () => {
      setChildKey("");
      setDownloaded(null);
      const fetched = await tierService.request(
        drop,
        address,
        registrationNonce(address, secret, seed),
        wallet,
      );
      setTier("assigned");
      setChildKey(fetched.childKey);
    });
  const register = (event) => {
    event.preventDefault();
    run("Registering participant", async () => {
      if (!backupReady)
        throw new Error(
          "Download your current registration JSON before registering.",
        );
      const record = await participantService.register(
        drop,
        { address, secret, seed, tier, childKey },
        wallet,
        setProgress,
      );
      setRegistration(record);
      setSecret("");
      setSeed("");
      await refresh();
    });
  };
  const claim = () =>
    run("Submitting claim", async () => {
      const block = phaseBlock(drop, "CLAIM");
      if (block) throw new Error(block);
      if (!proof || proof.wallet !== wallet?.address || proof.root !== drop.merkleRoot || proof.recipient !== recipient.toLowerCase())
        throw new Error("Generate a proof for this wallet and recipient first.");
      const result = await blockchainService.claim(wallet, drop, proof, setProgress);
      setReceipt(result);
      await refresh();
    });
  const block = phaseBlock(drop, registration ? "CLAIM" : "INITIAL");
  return !airdrops.length ? (
    <div className="minimal-empty">
      <Fingerprint size={30} strokeWidth={1.2} />
      <h2>No airdrops available</h2>
    </div>
  ) : (
    <div
      className={`simple-user airdrop-browser-layout ${selected ? "has-selection" : "grid-view"}`}
    >
      <AirdropBrowser
        airdrops={airdrops}
        selected={selected}
        onSelect={setSelected}
        busy={busy}
      />
      {drop && (
        <section className="simple-registration">
          <div className="simple-detail-heading">
            <h1>{drop.name}</h1>
            <Badge tone={receipt ? "completed" : statusTone(drop)}>
              {receipt
                ? "CLAIMED"
                : drop.phase === "ENDED"
                  ? "ENDED"
                  : drop.status === "PAUSED"
                    ? "PAUSED"
                    : registration
                      ? "REGISTERED"
                      : drop.phase !== "INITIAL"
                        ? "REGISTRATION CLOSED"
                        : "REGISTER"}
            </Badge>
          </div>
          {receipt ? (
            <div className="simple-success">
              <CheckCheck size={33} strokeWidth={1.3} />
              <h2>Reward claimed</h2>
              <strong>{displayAmount(receipt.amount)} ETH</strong>
              <HashValue label="Recipient" value={receipt.recipient} />
              <HashValue label="Transaction" value={receipt.hash} />
              <p className="small muted">
                This reward has already been claimed.
              </p>
            </div>
          ) : !registration && block ? (
            <div className="registration-closed">
              <LockKeyhole size={28} strokeWidth={1.4} />
              <h2>{block}</h2>
              {!wallet &&
                drop.phase === "CLAIM" &&
                drop.status === "ACTIVE" && (
                  <Button secondary onClick={connect} disabled={busy}>
                    Connect wallet to check registration
                  </Button>
                )}
            </div>
          ) : !registration ? (
            <form onSubmit={register} noValidate>
              <Field
                label="Address"
                value={address}
                placeholder="0x…"
                disabled={busy}
                onChange={(e) => {
                  if (!acceptsAddress(e.target.value)) return;
                  setAddress(e.target.value);
                  setChildKey("");
                  setDownloaded(null);
                  setError("");
                }}
              />
              <div className="registration-private">
                <SecretField
                  id="registration-secret"
                  label="Secret phrase"
                  autoComplete="off"
                  placeholder="App-specific secret phrase"
                  value={secret}
                  disabled={busy}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    setChildKey("");
                    setTier("");
                    setDownloaded(null);
                  }}
                />
                <SecretField
                  id="registration-seed"
                  label="Nullifier seed"
                  autoComplete="off"
                  placeholder="Decimal or 0x-prefixed field"
                  maxLength={78}
                  value={seed}
                  disabled={busy}
                  onChange={(e) => {
                    if (!acceptsField(e.target.value)) return;
                    setSeed(e.target.value);
                    setChildKey("");
                    setTier("");
                    setDownloaded(null);
                  }}
                />
              </div>
              <div className="tier-request">
                <Field label="Tier key">
                  <input
                    aria-label="Tier key"
                    disabled
                    value={childKey}
                    placeholder="Request your assigned tier key"
                  />
                </Field>
                <Button
                  secondary
                  type="button"
                  disabled={
                    busy ||
                    !wallet ||
                    !isAddress(address) ||
                    !secret.trim() ||
                    !validField(seed) ||
                    !!block
                  }
                  onClick={request}
                >
                  <KeyRound size={14} />
                  Request tier
                </Button>
              </div>
              {childKey && (
                <p className="received-key">
                  <Check size={14} />
                  Tier key received
                </p>
              )}
              {block && <Notice neutral>{block}</Notice>}
              <div className="registration-backup">
                <div>
                  <strong>Save your registration</strong>
                  <span>
                    Contains your secret, nullifier seed and tier key. Keep it
                    for proof generation.
                  </span>
                </div>
                <Button
                  secondary
                  type="button"
                  disabled={busy || !canDownload || !!block}
                  onClick={downloadRegistration}
                >
                  <Download size={15} />
                  {backupReady
                    ? "Download JSON again"
                    : "Download registration JSON"}
                </Button>
                {backupReady && (
                  <span className="backup-ready">
                    <Check size={14} />
                    Current inputs downloaded
                  </span>
                )}
              </div>
              <div className="simple-form-action">
                {!wallet ? (
                  <Button type="button" disabled={busy} onClick={connect}>
                    Connect wallet
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={busy || !childKey || !backupReady || !!block}
                    busy={!!progress}
                  >
                    Register
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <>
              <div className="registered-reward">
                <div>
                  <Check size={17} />
                  <span>Registered</span>
                </div>
              </div>
              {block ? (
                <Notice neutral>{block}</Notice>
              ) : (
                <ProofWorkspace
                  key={`${drop.key}:${walletAddress}`}
                  drop={drop}
                  registration={registration}
                  wallet={wallet}
                  busy={busy}
                  run={run}
                  proof={proof}
                  setProof={setProof}
                  recipient={recipient}
                  setRecipient={setRecipient}
                  claim={claim}
                />
              )}
            </>
          )}
          <Progress text={progress} />
          <Notice>{error}</Notice>
        </section>
      )}
    </div>
  );
}
