import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, LockKeyhole, Unlink2, ShieldCheck, Wallet, ChevronDown, LogOut } from "lucide-react";
import { Button } from "./components/ui";
import Toasts, { toast } from "./components/Toasts";
import Admin from "./pages/Admin";
import User from "./pages/User";
import { blockchainService, short, walletService } from "./services";
import { readContract } from "./chain";
import { participantsApi } from "./participants";
import DemoAccess from "./components/DemoAccess";

export default function App() {
  const [wallet, setWallet] = useState(null);
  const [home, setHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const [airdrops, setAirdrops] = useState([]);
  const [preview, setPreview] = useState(false);
  const lastError = useRef("");
  const view = preview && wallet ? "preview" : home || !wallet ? "landing" : wallet.role === "owner" ? "admin" : "user";
  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      if (wallet) {
        const [owner, superOwner] = await Promise.all([readContract().isOwner(wallet.address), readContract().superOwner()]);
        setWallet(current => current?.address === wallet.address ? { ...current, role: owner ? "owner" : "user", isSuper: superOwner.toLowerCase() === wallet.address.toLowerCase() } : current);
      }
      const drops = await blockchainService.list();
      const results = await Promise.allSettled(drops.map(async drop => {
        const status = await participantsApi.status(drop.key);
        return { ...drop, participants: status.count, registrationClosed: status.closed, issuerConfigured: status.configured };
      }));
      setAirdrops(drops.map((drop, i) => results[i].status === "fulfilled" ? results[i].value : { ...drop, registrationClosed: true }));
      if (results.some(result => result.status === "rejected")) throw new Error("Participant server unavailable. Registration is temporarily unavailable.");
      lastError.current = "";
    } catch (error) {
      const message = error.shortMessage || error.message;
      if (lastError.current !== message) toast(message);
      lastError.current = message;
    }
  }, [wallet?.address, preview]);
  useEffect(() => { if (!wallet && !preview) return; refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const changed = () => { setWallet(null); setWalletMenu(false); setHome(true); setPreview(false); setAirdrops([]); };
    provider.on("accountsChanged", changed); provider.on("chainChanged", changed);
    return () => { provider.removeListener("accountsChanged", changed); provider.removeListener("chainChanged", changed); };
  }, []);
  useEffect(() => { document.title = `Private Airdrop ? ${view === "admin" ? "Owner" : view === "user" ? "Airdrops" : "Welcome"}`; }, [view]);
  const connect = async () => {
    if (busy) return;
    setBusy(true); setConnecting(true);
    try {
      const connected = await walletService.connect();
      const [owner, superOwner] = await Promise.all([readContract().isOwner(connected.address), readContract().superOwner()]);
      const result = { ...connected, role: owner ? "owner" : "user", isSuper: superOwner.toLowerCase() === connected.address.toLowerCase() };
      setWallet(result); setHome(false); setPreview(false); location.hash = "";
      return result;
    } catch (error) { toast(error.shortMessage || error.message); }
    finally { setBusy(false); setConnecting(false); }
  };
  const shared = { wallet, connect, busy, setBusy, airdrops, setAirdrops, refresh };
  return <div className="app-shell">
    <Toasts />
    <header className="topbar">
      <button className="brand" onClick={() => { setHome(true); setPreview(false); }} aria-label="Private Airdrop home"><span className="brand-symbol"><Fingerprint size={26} strokeWidth={1.45} /></span><span>Private Airdrop</span></button>
      <div className="topbar-actions">
        {wallet && <button className="text-button" disabled={busy} onClick={() => { setHome(false); setPreview(false); }}>{wallet.role === "owner" ? "Owner dashboard" : "Airdrops"}</button>}
        <DemoAccess wallet={wallet} connect={connect} busy={busy} setBusy={setBusy} onPreview={() => setPreview(true)} onGranted={async account => { const owner = await readContract().isOwner(account.address); setWallet({ ...account, role: owner ? "owner" : "user" }); setHome(false); setPreview(false); }} />
        <div className="wallet-control">{wallet ? <>
          <button className="wallet-button" disabled={busy} aria-expanded={walletMenu} onClick={() => setWalletMenu(!walletMenu)}><span className="connected-dot" />{short(wallet.address)}<ChevronDown size={13} /></button>
          {walletMenu && <div className="wallet-menu"><span>Sepolia ? {wallet.role === "owner" ? "Owner" : "User"}</span><button disabled={busy} onClick={() => { setWallet(null); setHome(true); setWalletMenu(false); setAirdrops([]); }}><LogOut size={14} />Disconnect</button></div>}
        </> : <Button secondary disabled={busy} busy={connecting} onClick={connect}>{!connecting && <Wallet size={15} />}{connecting ? "Connecting?" : "Connect wallet"}</Button>}</div>
      </div>
    </header>
    <main>
<section hidden={view !== 'landing'} className="landing"><div className="landing-title"><span className="hero-symbol"><Fingerprint size={50} strokeWidth={1} /></span><h1>Private Airdrop</h1></div><div className="principles">{[[LockKeyhole, '01', 'Client-side', 'Your private inputs stay with you.'], [Unlink2, '02', 'Private membership', 'Prove membership without publishing your private inputs.'], [ShieldCheck, '03', 'ZK-verified', 'A proof of eligibility. Not your personal details.']].map(([Icon, n, title, text]) => <article key={n}><div className="principle-top"><Icon size={28} strokeWidth={1.25} /><span>{n}</span></div><h2>{title}</h2><p>{text}</p></article>)}</div></section>
      {view === "admin" && wallet?.role === "owner" && <Admin key={wallet.address} {...shared} />}
      {view === "user" && wallet && <User key={wallet.address} {...shared} />}
      {view === "preview" && wallet && <Admin key={`preview-${wallet.address}`} {...shared} readOnly />}
    </main>
  </div>;
}
