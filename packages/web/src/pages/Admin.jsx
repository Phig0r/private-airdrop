import OwnerTools from "../components/OwnerTools";
import { toast } from "../components/Toasts";
import { acceptsEth } from "../inputRules";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Database,
  Download,
  Fingerprint,
  Eye,
  GitBranch,
  KeyRound,
  Pause,
  Play,
  Plus,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import AirdropBrowser from "../components/AirdropBrowser";
import TreePreview from "../components/TreePreview";
import {
  Badge,
  Button,
  ExpandingInput,
  Field,
  HashValue,
  Notice,
  Progress,
} from "../components/ui";
import {
  blockchainService,
  displayAmount,
  exportTree,
  key,
  merkleService,
  newTier,
  participantService,
  remaining,
  short,
  tierService,
  validateSetup,
  downloadJson,
  statusTone,
  phaseLabel,
  units,
} from "../services";

function ClaimInputs({ root, tiers }) {
  return (
    <div className="claim-input-list">
      {root && <HashValue label="Merkle root" value={root} />}
      {tiers.map((tier) => (
        <div className="claim-tier-input-row" key={tier.masterKey}>
          <HashValue label={`${tier.name} master key`} value={tier.masterKey} />
          <Field
            label="Reward (ETH)"
            aria-label={`${tier.name} reward (ETH)`}
            value={tier.value}
            note={`${tier.amountWei ?? units(tier.value).toString()} wei`}
            disabled
          />
        </div>
      ))}
    </div>
  );
}

export default function Admin({
  wallet,
  connect,
  busy,
  setBusy,
  airdrops,
  setAirdrops,
  refresh,
  readOnly = false,
}) {
  const [tab, setTab] = useState("manage");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [tiers, setTiers] = useState(() => [newTier()]);
  const [expandedKeys, setExpandedKeys] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [selected, setSelected] = useState(null);
  const [snapshots, setSnapshots] = useState({});
  const [trees, setTrees] = useState({});
  const [manageView, setManageView] = useState("registration");
  const [loadedRoots, setLoadedRoots] = useState({});
  const [loadedTiers, setLoadedTiers] = useState({});
  useEffect(() => { setLoadedTiers({}); setLoadedRoots({}); }, [wallet?.address]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const drop = airdrops.find((item) => item.key === selected);
  const records = snapshots[selected];
  const tree = trees[selected];
  const inputsLoaded = !!tree && loadedRoots[selected] === tree.root;
  const stale = records && drop && records.length !== drop.participants;
  const edit = (id, field, value) => {
    setTiers((all) =>
      all.map((t) =>
        t.key === id
          ? {
              ...t,
              [field]: value,
              ...(field === "keyType" ? { masterKey: null } : {}),
            }
          : t,
      ),
    );
    setErrors({});
  };
  async function run(label, action) {
    if (busy || readOnly) return;
    setBusy(true);
    setError("");
    setProgress(label);
    try {
      await action();
    } catch (e) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  const create = (event) => {
    event.preventDefault();
    const validation = validateSetup(name, budget, tiers);
    setErrors(validation);
    if (Object.keys(validation).length) { toast("Check the airdrop fields."); return; }
    run("Creating airdrop", async () => {
      const created = await blockchainService.create(wallet, name, budget, setProgress);
      // Keep the confirmed drop visible even if saving its private tiers fails.
      setAirdrops((all) => [created, ...all.filter(item => item.key !== created.key)]);
      setSelected(created.key);
      setTab("manage");
      setManageView("registration");
      setName("");
      setBudget("");
      downloadJson({ version: 1, tiers }, `airdrop-${created.key}-master-keys.json`);
      setProgress("Confirm the signature to save reward tiers");
      try {
        await tierService.save(created, tiers, wallet);
      } catch (error) {
        await refresh();
        throw new Error(`Airdrop created, but its tiers were not saved. Use Save reward tiers here to retry without creating another airdrop. ${error.shortMessage || error.message}`);
      }
      await refresh();
      toast("Airdrop created and reward tiers saved.");
      setTiers([newTier()]);
      setExpandedKeys({});
    });
  };
  const fetch = () =>
    run("Fetching participants", async () => {
      const data = await participantService.fetch(drop, wallet);
      setLoadedRoots((all) => ({ ...all, [drop.key]: null }));
      setSnapshots((all) => ({ ...all, [drop.key]: data }));
      setTrees((all) => ({ ...all, [drop.key]: null }));
      await refresh();
      setAirdrops((all) => all.map((item) => item.key === drop.key
        ? { ...item, participants: data.length } : item));
    });
  const build = () =>
    run("Building Merkle tree", async () => {
      if (stale)
        throw new Error(
          "New participants registered. Fetch participants again.",
        );
      setTrees((all) => ({ ...all, [drop.key]: null }));
      setLoadedRoots((all) => ({ ...all, [drop.key]: null }));
      const result = await merkleService.build(records || []);
      setTrees((all) => ({ ...all, [drop.key]: result }));
    });
  const change = (action) => {
    setConfirmEnd(false);
    run(
      action === "start" ? "Starting claim phase" : "Updating airdrop",
      async () => {
        if (drop.phase === "ENDED") throw new Error("This airdrop has ended.");
        if (
          action === "start" &&
          (!tree ||
            !inputsLoaded ||
            stale ||
            drop.phase !== "INITIAL" ||
            drop.status !== "ACTIVE")
        )
          throw new Error("Build an up-to-date tree before starting claims.");
        await blockchainService.change(wallet, drop, action, tree, loadedTiers[drop.key] || [], setProgress);
        await refresh();
      },
    );
  };
  const saveTiers = () => run("Saving reward tiers", async () => {
    const validation = validateSetup(drop.name, drop.maxBudget, tiers);
    setErrors(validation);
    if (Object.keys(validation).length) { toast("Check the reward tier fields."); return; }
    downloadJson({ version: 1, tiers }, "airdrop-master-keys.json");
    await tierService.save(drop, tiers, wallet);
    await refresh();
  });
  const tierEditor = <div>
            <div className="simple-section-heading">
              <h2>Reward tiers</h2>
              <button
                type="button"
                className="text-button"
                disabled={busy || tiers.length >= 32}
                onClick={() => setTiers((all) => [...all, newTier()])}
              >
                <Plus size={14} />
                Add tier
              </button>
            </div>
            <div className="simple-tier-list">
              {tiers.map((tier, i) => (
                <div className="simple-tier" key={tier.key}>
                  <div className="simple-tier-number">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="simple-tier-fields">
                    <Field label="Tier name">
                      <input
                        aria-label={`Tier ${i + 1} name`}
                        value={tier.name}
                        placeholder="Name"
                        disabled={busy}
                        maxLength={40}
                        onChange={(e) => edit(tier.key, "name", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Reward (ETH)"
                    >
                      <input
                        aria-label={`Tier ${i + 1} reward`}
                        value={tier.value}
                        placeholder="0.00"
                        inputMode="decimal"
                        disabled={busy}
                        onChange={(e) =>
                          acceptsEth(e.target.value) &&
                          edit(tier.key, "value", e.target.value)
                        }
                      />
                    </Field>
                    <div className="field generated-key-field">
                      <div className="generated-key-caption">
                        <label
                          className="field-label"
                          htmlFor={`tier-key-${tier.key}`}
                        >
                          Generated key
                        </label>
                        {tier.masterKey && (
                          <button
                            type="button"
                            className="text-button"
                            aria-label={`${expandedKeys[tier.key] ? "Collapse" : "View full"} tier ${i + 1} key`}
                            aria-expanded={!!expandedKeys[tier.key]}
                            aria-controls={`tier-key-${tier.key}`}
                            onClick={() =>
                              setExpandedKeys((all) => ({
                                ...all,
                                [tier.key]: !all[tier.key],
                              }))
                            }
                          >
                            {expandedKeys[tier.key] ? "Collapse" : "View full"}
                          </button>
                        )}
                      </div>
                      <ExpandingInput
                        id={`tier-key-${tier.key}`}
                        label={`Tier ${i + 1} generated key`}
                        value={tier.masterKey ? (expandedKeys[tier.key] ? tier.masterKey : short(tier.masterKey)) : ""}
                        placeholder="BN254 field key"
                        title={tier.masterKey || ""}
                        animate
                      />
                    </div>
                    <Field label="BN254">
                      <Button
                        aria-label={
                          tier.masterKey ? "Generated" : "Generate key"
                        }
                        secondary
                        type="button"
                        disabled={busy || readOnly || !tier.keyType || !!tier.masterKey}
                        onClick={() =>
                          run("Generating master key", async () =>
                            edit(
                              tier.key,
                              "masterKey",
                              await tierService.generate(tier.keyType),
                            ),
                          )
                        }
                      >
                        {tier.masterKey ? (
                          <Check size={14} />
                        ) : (
                          <KeyRound size={14} />
                        )}
                        {tier.masterKey ? "Generated" : "Generate key"}
                      </Button>
                    </Field>
                  </div>
                  <button
                    type="button"
                    className="icon-button remove-tier"
                    aria-label={`Remove tier ${i + 1}`}
                    disabled={busy || tiers.length === 1}
                    onClick={() =>
                      setTiers((all) => all.filter((t) => t.key !== tier.key))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                  {errors[tier.key] && (
                    <p className="field-error">{errors[tier.key]}</p>
                  )}
                </div>
              ))}
            </div>
    {tab !== "create" && <div className="simple-form-action"><Button type="button" disabled={busy || readOnly} onClick={saveTiers}>Save reward tiers</Button></div>}
  </div>;
  return (
    <div className="minimal-admin">
      {readOnly && <div className="access-notice"><Eye size={19} /><div><strong>Read-only admin preview</strong><p>Explore the admin screens. Transactions and private server requests are disabled.</p></div></div>}
      {!readOnly && !wallet.isSuper && <div className="access-notice"><KeyRound size={19} /><div><strong>Admin write access</strong><p>You can create and manage testnet airdrops. Withdrawals, owner roles and demo controls are reserved for the project owner.</p></div></div>}
      <div className="workspace-tabs">
        <div className="tabs">
          <button
            className={tab === "create" ? "selected" : ""}
            disabled={busy}
            onClick={() => {
              setTab("create");
              setError("");
            }}
          >
            Create airdrop
          </button>
          <button
            className={tab === "manage" ? "selected" : ""}
            disabled={busy}
            onClick={() => {
              setTab("manage");
              setSelected(null);
              setError("");
            }}
          >
            Manage airdrops
          </button>
          <button className={tab === "owners" ? "selected" : ""} disabled={busy} onClick={() => setTab("owners")}>Access & pool</button>
        </div>
      </div>
      {tab === "owners" ? <OwnerTools readOnly={readOnly} wallet={wallet} busy={busy} setBusy={setBusy} refresh={refresh} /> : tab === "create" ? (
        <section className="simple-form">
          <h1>
            <Plus size={22} strokeWidth={1.5} />
            Create airdrop
          </h1>
          <form onSubmit={create} noValidate>
            <fieldset className="admin-form-fields" disabled={busy || readOnly}>
            <div className="basic-fields">
              <Field
                label="Airdrop name"
                placeholder="Name"
                value={name}
                maxLength={60}
                disabled={busy}
                error={errors.name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({});
                }}
              />
              <Field
                aria-label="Maximum budget (ETH)"
                label="Maximum budget (ETH)"
                inputMode="decimal"
                placeholder="0.00"
                value={budget}
                disabled={busy}
                error={errors.budget}
                onChange={(e) => {
                  if (!acceptsEth(e.target.value)) return;
                  setBudget(e.target.value);
                  setErrors({});
                }}
              />
            </div>
            {tierEditor}
            <div className="simple-form-action">
              {!wallet ? (
                <Button type="button" disabled={busy} onClick={connect}>
                  Connect wallet
                </Button>
              ) : (
                <Button type="submit" disabled={busy} busy={!!progress}>
                  Create airdrop
                  <ArrowRight size={15} />
                </Button>
              )}
            </div>
            </fieldset>
          </form>
          <Progress text={progress} />
          <Notice>{error}</Notice>
        </section>
      ) : !airdrops.length ? (
        <div className="minimal-empty">
          <Fingerprint size={30} strokeWidth={1.2} />
          <h2>No airdrops yet</h2>
          <Button secondary onClick={() => setTab("create")}>
            <Plus size={15} />
            Create airdrop
          </Button>
        </div>
      ) : (
        <div
          className={`simple-management airdrop-browser-layout ${selected ? "has-selection" : "grid-view"}`}
        >
          <AirdropBrowser
            admin
            airdrops={airdrops}
            selected={selected}
            busy={busy}
            onSelect={(value) => {
              setSelected(value);
              setTiers([newTier()]); setExpandedKeys({}); setErrors({});
              setManageView("registration");
              setError("");
              setConfirmEnd(false);
            }}
          />
          {drop && (
            <section className="simple-drop-detail">
              <div className="simple-detail-heading">
                <h1>{drop.name}</h1>
                <div>
                  {drop.phase !== "ENDED" && drop.status !== "COMPLETED" && (
                    <>
                      <button
                        className="text-button"
                        disabled={busy || readOnly || !wallet}
                        onClick={() =>
                          change(drop.status === "PAUSED" ? "resume" : "pause")
                        }
                      >
                        {drop.status === "PAUSED" ? (
                          <Play size={14} />
                        ) : (
                          <Pause size={14} />
                        )}
                        {drop.status === "PAUSED" ? "Resume" : "Pause"}
                      </button>
                      <button
                        className="text-button danger"
                        disabled={busy || readOnly || !wallet}
                        onClick={() => setConfirmEnd(true)}
                      >
                        <Square size={12} />
                        End airdrop
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="detail-phase">
                <Badge>{phaseLabel(drop)}</Badge>
                <Badge tone={statusTone(drop)}>{drop.status}</Badge>
              </div>
              <div className="simple-metadata">
                <div>
                  <span>Total claimed</span>
                  <strong>{displayAmount(drop.totalClaimed)} ETH</strong>
                </div>
                <div>
                  <span>Remaining budget</span>
                  <strong>{displayAmount(remaining(drop))} ETH</strong>
                </div>
                <div>
                  <span>Deployed</span>
                  <strong>
                    {new Date(drop.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>
              </div>
              {drop.phase === "INITIAL" ? (
                <>
                  <nav
                    className="phase-navigation"
                    aria-label="Airdrop management sections"
                  >
                    <button
                      className={
                        manageView === "registration" ? "selected" : ""
                      }
                      onClick={() => setManageView("registration")}
                    >
                      <Database size={15} />
                      Registration & tree
                    </button>
                    <button
                      className={manageView === "claims" ? "selected" : ""}
                      onClick={() => setManageView("claims")}
                    >
                      <Send size={15} />
                      Claim setup
                    </button>
                  </nav>
                  {manageView === "registration" ? (
                    <section className="registration-management">
                      {!drop.issuerConfigured && <fieldset className="admin-form-fields" disabled={readOnly || busy}>{tierEditor}</fieldset>}
                      {drop.issuerConfigured && <p className="received-key"><Check size={14} /> Reward tiers saved</p>}
                      <label className="button secondary file-button">
                        Restore issuer keys
                        <input type="file" accept=".json,application/json" disabled={busy || readOnly} onChange={event => {
                          const file = event.target.files[0]; event.target.value = "";
                          if (file) run("Restoring issuer keys", async () => {
                            if (file.size > 32000) throw new Error("Key backup is too large.");
                            const backup = JSON.parse(await file.text());
                            if (backup.version !== 1 || !Array.isArray(backup.tiers)) throw new Error("Invalid master key backup.");
                            await tierService.save(drop, backup.tiers, wallet);
                            await refresh();
                          });
                        }} />
                      </label>
                      <div className="compact-tree-row">
                        <TreePreview
                          count={drop.participants}
                          built={!!tree && !stale}
                        />
                        <div className="participant-summary">
                          <strong>{drop.participants}</strong>
                          <span>registered participants</span>
                          <small>
                            {records
                              ? `${records.length} participants fetched`
                              : "Ready to fetch"}
                          </small>
                        </div>
                      </div>
                      {stale && (
                        <Notice neutral>
                          New registrations are available. Fetch participants
                          again.
                        </Notice>
                      )}
                      <div className="management-flow-actions">
                        <Button
                          secondary
                          disabled={busy || readOnly || !wallet || !drop.issuerConfigured || !drop.participants || drop.status !== "ACTIVE"}
                          onClick={fetch}
                        >
                          <Database size={14} />
                          {drop.registrationClosed ? "Fetch participants" : "Close registration & fetch"}
                        </Button>
                        <Button
                          secondary
                          disabled={
                            busy || readOnly ||
                            !wallet ||
                            !records?.length ||
                            stale ||
                            drop.status !== "ACTIVE"
                          }
                          onClick={build}
                        >
                          <GitBranch size={15} />
                          {tree ? "Rebuild tree" : "Build Merkle tree"}
                        </Button>
                        {tree && (
                          <Button
                            secondary
                            disabled={!!stale}
                            onClick={() => exportTree(tree)}
                          >
                            <Download size={14} />
                            Download JSON
                          </Button>
                        )}
                      </div>
                      <div className="management-next">
                        <span>
                          {tree && !stale
                            ? "Tree ready"
                            : "Fetch participants, then build the tree."}
                        </span>
                        <Button
                          disabled={
                            !tree || stale || busy || drop.status !== "ACTIVE"
                          }
                          onClick={() => setManageView("claims")}
                        >
                          Continue to claim setup
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </section>
                  ) : (
                    <section className="claim-setup">
                      <div className="simple-section-heading">
                        <h2>Prepare claim phase</h2>
                        <Button
                          secondary
                          disabled={
                            busy || readOnly || !tree || stale || drop.status !== "ACTIVE"
                          }
                          onClick={() => run("Loading claim inputs", async () => {
                            const values = await tierService.load(drop, wallet);
                            setLoadedTiers(all => ({ ...all, [drop.key]: values }));
                            setLoadedRoots(all => ({ ...all, [drop.key]: tree.root }));
                          })}
                        >
                          <Download size={14} />
                          {inputsLoaded
                            ? "Reload claim inputs"
                            : "Load claim inputs"}
                        </Button>
                      </div>
                      {inputsLoaded && !stale ? (
                        <ClaimInputs root={tree.root} tiers={loadedTiers[drop.key] || []} />
                      ) : (
                        <p className="setup-placeholder">
                          {!tree || stale
                            ? "Build an up-to-date tree in Registration & tree first."
                            : "Load the Merkle root, tier keys and rewards."}
                        </p>
                      )}
                      <div className="management-next">
                        <span>{(loadedTiers[drop.key] || drop.rewardTiers).length} reward tiers</span>
                        <Button
                          disabled={
                            busy || readOnly ||
                            !wallet ||
                            !inputsLoaded ||
                            stale ||
                            drop.status !== "ACTIVE"
                          }
                          onClick={() => change("start")}
                        >
                          <Send size={15} />
                          Start claim phase
                        </Button>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <section className="claim-management">
                  <div className="simple-section-heading">
                    <h2>
                      {drop.phase === "ENDED"
                        ? "Airdrop ended"
                        : drop.status === "COMPLETED"
                          ? "Airdrop completed"
                          : "Phase 2 - Claims"}
                    </h2>
                    <span className="muted small">
                      {drop.participants} participants
                    </span>
                  </div>
                  <div className="simple-reward-rows">
                    {drop.rewardTiers.map((tier) => (
                      <div key={tier.key}>
                        <span>
                          <KeyRound size={14} />
                          {tier.name}
                        </span>
                        <span className="muted small">Tier configured</span>
                        <span className="muted small">{drop.merkleRoot ? "Published" : "Not published"}</span>
                      </div>
                    ))}
                  </div>
                  {drop.merkleRoot && <details className="published-inputs">
                    <summary>View published claim inputs</summary>
                    <ClaimInputs root={drop.merkleRoot} tiers={drop.publicTierKeys || []} />
                  </details>}
                  {drop.phase === "ENDED" && (
                    <Notice neutral>This airdrop has ended.</Notice>
                  )}
                </section>
              )}
              {confirmEnd && (
                <div className="end-confirm">
                  <p>End this airdrop? Registration and claims will close.</p>
                  <Button
                    secondary
                    disabled={busy}
                    onClick={() => setConfirmEnd(false)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy || readOnly} onClick={() => change("end")}>
                    Confirm end
                  </Button>
                </div>
              )}
              {!wallet && (
                <Button secondary disabled={busy} onClick={connect}>
                  Connect wallet
                </Button>
              )}
              <Progress text={progress} />
              <Notice>{error}</Notice>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
