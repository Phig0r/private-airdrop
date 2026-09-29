import { useEffect, useRef, useState } from "react";
import { Eye, KeyRound, X, Network } from "lucide-react";
import { Button } from "./ui";
import { toast } from "./Toasts";
import { blockchainService, readContract, walletService } from "../chain";

export default function DemoAccess({ wallet, connect, busy, setBusy, onPreview, onGranted }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!open) return;
    dialog.current.showModal();
    let current = true;
    setEnabled(null); setUnavailable(false);
    const check = async () => {
      try {
        const contract = readContract();
        if ((await contract.runner.getNetwork()).chainId !== 11155111n) throw new Error("Wrong chain");
        const [faucet, active] = await contract.demoAccess();
        if (current) { setEnabled(active && BigInt(faucet) !== 0n); setUnavailable(false); }
      } catch { if (current) { setEnabled(false); setUnavailable(true); } }
    };
    check(); const timer = setInterval(check, 15000);
    return () => { current = false; clearInterval(timer); };
  }, [open]);
  const close = () => { dialog.current.close(); setOpen(false); };
  async function preview() {
    setPending(true);
    try {
      const account = wallet || await connect();
      if (account) { onPreview(); close(); }
    } finally { setPending(false); }
  }
  async function request() {
    setPending(true);
    try {
      const account = wallet || await connect();
      if (!account) return;
      setBusy(true);
      await blockchainService.requestDemo(account);
      await onGranted(account);
      close();
    } catch (error) { toast(error.shortMessage || error.message); }
    finally { setPending(false); setBusy(false); }
  }
  return <>
    <Button secondary disabled={busy} onClick={() => setOpen(true)}>Demo access</Button>
    <dialog className="demo-dialog" ref={dialog} onClose={() => setOpen(false)} onCancel={event => pending && event.preventDefault()} aria-labelledby="demo-title">
      <div className="demo-heading"><h2 id="demo-title">Explore Private Airdrop</h2><button aria-label="Close demo access" disabled={pending} onClick={close}><X size={20} /></button></div>
      <div className="demo-network"><Network size={22} /><div><strong>Use the Sepolia test network</strong><p>Both modes require a connected wallet on Sepolia.</p></div><Button secondary busy={networkBusy} disabled={pending} onClick={async () => { setNetworkBusy(true); try { await walletService.addSepolia(); } catch (error) { toast(error.shortMessage || error.message); } finally { setNetworkBusy(false); } }}>Switch to Sepolia</Button><span className="field-note">Adds Sepolia if it is missing · Chain ID 11155111</span></div>
      <div className="demo-choice"><Eye size={22} /><h3>View only</h3><p>Connect your wallet to explore the forms and live airdrops. No admin role is needed. This mode cannot send transactions.</p><Button secondary disabled={pending || busy} onClick={preview}>Open read-only preview</Button></div>
      <div className="demo-choice"><KeyRound size={22} /><h3>Try admin features</h3><p>Request a demo role to create and manage real testnet airdrops. You need a wallet and Sepolia ETH for gas. Withdrawals and access controls stay with the project owner.</p>
        <Button busy={pending} disabled={busy || !enabled} onClick={request}>{pending ? "Confirm in your wallet" : "Request demo admin role"}</Button>
        <span className="field-note">{enabled === null ? "Checking the contract on Sepolia…" : unavailable ? "Cannot read demo access. The contract may not be deployed or the RPC may be unavailable." : enabled ? "Enabled on chain. Access lasts while the demo faucet is enabled." : "Demo access is disabled on chain. You can still use view-only mode."}</span>
      </div>
    </dialog>
  </>;
}
