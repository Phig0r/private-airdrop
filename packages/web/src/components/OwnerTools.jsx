import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, FlaskConical, Plus, ShieldCheck, Trash2, Users, Wallet } from "lucide-react";
import { Badge, Button, Field, Progress } from "./ui";
import { toast } from "./Toasts";
import { readContract, blockchainService } from "../chain";
import { fromUnits, units } from "../amounts";
import { isAddress, short } from "../services";
import { acceptsAddress, acceptsEth } from "../inputRules";

export default function OwnerTools({ wallet, busy, setBusy, refresh, readOnly = false }) {
  const [view, setView] = useState("pool");
  const [operation, setOperation] = useState("fund");
  const [owners, setOwners] = useState([]);
  const [superOwner, setSuperOwner] = useState("");
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [addresses, setAddresses] = useState("");
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipient, setRecipient] = useState(wallet.address);
  const [faucet, setFaucet] = useState("");
  const [faucetDraft, setFaucetDraft] = useState("");
  const [editingFaucet, setEditingFaucet] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    const contract = readContract();
    const [accounts, pool, demo, originalOwner] = await Promise.all([contract.owners(), contract.poolBalance(), contract.demoAccess(), contract.superOwner()]);
    setOwners(Array.from(accounts)); setBalance(fromUnits(pool));
    setSuperOwner(originalOwner);
    setFaucet(demo[0]); setDemoEnabled(demo[1]); setLoaded(true);
  };
  useEffect(() => {
    const update = () => load().catch(error => toast(error.shortMessage || error.message));
    update(); const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, []);
  async function run(action) {
    if (busy || readOnly) return;
    setBusy(true);
    try { await action(); await load(); await refresh(); }
    catch (error) { toast(error.shortMessage || error.message); }
    finally { setBusy(false); setProgress(""); }
  }
  const canManage = wallet.isSuper && !readOnly;
  const isSelf = account => account.toLowerCase() === wallet.address.toLowerCase();
  const isSuperOwner = account => account.toLowerCase() === superOwner.toLowerCase();
  const validAmount = value => { try { units(value); return true; } catch { return false; } };
  const withdrawalFits = validAmount(withdrawAmount) && balance !== null && balance !== "0" && units(withdrawAmount) <= units(balance);
  const pages = [["pool", Wallet, "Shared pool", "Fund & withdraw"], ["owners", Users, "Owners", "Permanent access"], ["demo", FlaskConical, "Demo access", "Reviewer permissions"]];

  return <section className="owner-workspace">
    <header className="owner-workspace-heading">
      <div><h1>Access & pool</h1><p>Sepolia · {readOnly ? "Read-only preview" : "Contract administration"}</p></div>
      <Badge><ShieldCheck size={12} />{readOnly ? "View only" : wallet.isSuper ? "Super owner" : "Owner"}</Badge>
    </header>
    <div className="owner-workspace-body">
      <nav className="owner-navigation" aria-label="Access and pool sections">
        {pages.map(([id, Icon, title, description]) => <button key={id} aria-current={view === id ? "page" : undefined} className={view === id ? "selected" : ""} disabled={busy} onClick={() => setView(id)}>
          <Icon size={19} strokeWidth={1.5} /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={14} />
        </button>)}
      </nav>
      <div className="owner-content">
        {view === "pool" && <>
          <div className="pool-balance-display"><div><span>Available balance</span><strong>{balance === null ? "—" : balance}<small>ETH</small></strong><p>Shared across all airdrops</p></div><span className="pool-balance-icon"><Wallet size={28} strokeWidth={1.25} /></span></div>
          <div className="pool-operation-tabs" aria-label="Pool action">
            <button className={operation === "fund" ? "selected" : ""} disabled={busy} onClick={() => setOperation("fund")}><ArrowDownLeft size={16} />Add funds</button>
            <button className={operation === "withdraw" ? "selected" : ""} disabled={busy} onClick={() => setOperation("withdraw")}><ArrowUpRight size={16} />Withdraw</button>
          </div>
          <form className="owner-action-form" onSubmit={event => {
            event.preventDefault();
            run(async () => {
              if (operation === "fund") { await blockchainService.fund(wallet, amount, setProgress); setAmount(""); }
              else { await blockchainService.withdraw(wallet, recipient, withdrawAmount, setProgress); setWithdrawAmount(""); }
              toast(operation === "fund" ? "Pool funded." : "Withdrawal confirmed.");
            });
          }}>
            {operation === "withdraw" && <Field label="Recipient wallet" value={recipient} placeholder="0x…" disabled={busy || !canManage} maxLength={42} onChange={event => acceptsAddress(event.target.value) && setRecipient(event.target.value)} />}
            <Field label="Amount (ETH)" inputMode="decimal" value={operation === "fund" ? amount : withdrawAmount} placeholder="0.00" disabled={busy || readOnly || (operation === "withdraw" && !canManage)} onChange={event => acceptsEth(event.target.value) && (operation === "fund" ? setAmount(event.target.value) : setWithdrawAmount(event.target.value))} />
            <div className="owner-action-footer"><p>{operation === "fund" ? "Funds cover rewards. Relayer gas is funded separately." : (canManage ? "Withdrawals reduce the funds available for claims." : "Only the super owner can withdraw funds.")}</p><Button type="submit" disabled={busy || readOnly || (operation === "withdraw" && !canManage) || (operation === "fund" ? !validAmount(amount) : !withdrawalFits || !isAddress(recipient))}>{operation === "fund" ? "Fund pool" : "Withdraw ETH"}{operation === "fund" ? <Plus size={15} /> : <ArrowUpRight size={15} />}</Button></div>
          </form>
        </>}
        {view === "owners" && <>
          <div className="owner-section-heading"><div><h2>Permanent owners</h2><p>Owners can manage every airdrop. Only the super owner can assign roles.</p></div><Badge>{owners.length} total</Badge></div>
          <div className="owner-access-grid">
            <form className="owner-action-form" onSubmit={event => {
              event.preventDefault();
              run(async () => {
                const accounts = [...new Set(addresses.split(/[\s,]+/).filter(Boolean).map(address => address.toLowerCase()))];
                if (!accounts.length || !accounts.every(isAddress)) throw new Error("Enter valid wallet addresses, one per line.");
                await blockchainService.setOwners(wallet, accounts, true, setProgress);
                setAddresses(""); toast("Owner access updated.");
              });
            }}><Field label="Add wallet addresses"><textarea aria-label="Owner wallet addresses" disabled={busy || !canManage} value={addresses} placeholder={"0x…\nOne address per line"} spellCheck={false} onChange={event => setAddresses(event.target.value)} /></Field><Button type="submit" disabled={busy || !canManage || !addresses.trim()}><Plus size={15} />Add owners</Button></form>
            <div className="owner-current-access"><span className="field-label">Current access</span><div className="owner-account-list">{owners.map(account => <label className="owner-account-row" key={account}>
              <input type="checkbox" aria-label={`Select ${account}`} disabled={busy || !canManage || isSuperOwner(account)} checked={selected.includes(account)} onChange={event => setSelected(all => event.target.checked ? [...all, account] : all.filter(item => item !== account))} />
              <span><code title={account}>{short(account)}</code><small>{isSelf(account) ? "You · " : ""}{isSuperOwner(account) ? "Super owner" : "Permanent owner"}</small></span>{isSuperOwner(account) && <ShieldCheck size={16} />}
            </label>)}</div><Button secondary disabled={busy || !canManage || !selected.length} onClick={() => run(async () => { await blockchainService.setOwners(wallet, selected, false, setProgress); setSelected([]); toast("Selected owners removed."); })}><Trash2 size={14} />Remove{selected.length ? ` ${selected.length} selected` : " selected"}</Button></div>
          </div>
        </>}
        {view === "demo" && <>
          <div className="owner-section-heading"><div><h2>Demo access</h2><p>Let reviewers request an admin role. Controlled by the super owner.</p></div><Badge tone={!loaded ? "" : demoEnabled ? "good" : "paused"}>{!loaded ? "Loading" : demoEnabled ? "Enabled" : "Disabled"}</Badge></div>
          <div className="demo-control-row"><span className="demo-control-icon"><FlaskConical size={24} strokeWidth={1.4} /></span><div><h3>{demoEnabled ? "Role requests are open" : "Role requests are closed"}</h3><p>{demoEnabled ? "Reviewers can manage airdrops. Withdrawals and access settings remain restricted." : "Demo roles are suspended. Read-only preview remains available."}</p></div><Button secondary disabled={busy || !canManage || !loaded || !isAddress(faucet)} onClick={() => run(() => blockchainService.setDemoFaucet(wallet, faucet, !demoEnabled, setProgress))}>{demoEnabled ? "Disable access" : "Enable access"}</Button></div>
          <div className="faucet-settings"><div><span className="field-label">Approved role faucet</span><code>{faucet || "Loading…"}</code></div><button type="button" className="text-button" disabled={busy || !canManage || !loaded} onClick={() => { setFaucetDraft(faucet); setEditingFaucet(!editingFaucet); }}>{editingFaucet ? "Cancel" : "Change contract"}</button></div>
          {editingFaucet && <form className="owner-action-form faucet-edit" onSubmit={event => { event.preventDefault(); run(async () => { await blockchainService.setDemoFaucet(wallet, faucetDraft, demoEnabled, setProgress); setEditingFaucet(false); }); }}><Field label="New faucet contract" value={faucetDraft} placeholder="0x…" maxLength={42} disabled={busy || !canManage} onChange={event => acceptsAddress(event.target.value) && setFaucetDraft(event.target.value)} /><Button type="submit" secondary disabled={busy || !canManage || !isAddress(faucetDraft) || faucetDraft.toLowerCase() === faucet.toLowerCase()}><Check size={14} />Save contract</Button></form>}
        </>}
        <Progress text={progress} />
      </div>
    </div>
  </section>;
}
