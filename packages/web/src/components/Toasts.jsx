import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";

export function toast(message) {
  window.dispatchEvent(new CustomEvent("airdrop-toast", { detail: String(message) }));
}

export default function Toasts() {
  const [items, setItems] = useState([]);
  const [container, setContainer] = useState(document.body);
  useEffect(() => {
    const update = () => setContainer(document.querySelector("dialog[open]") || document.body);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], childList: true });
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const timers = new Set();
    const show = event => {
      const id = crypto.randomUUID();
      setItems(all => [...all.filter(item => item.message !== event.detail), { id, message: event.detail }].slice(-3));
      const timer = setTimeout(() => { setItems(all => all.filter(item => item.id !== id)); timers.delete(timer); }, 7000);
      timers.add(timer);
    };
    window.addEventListener("airdrop-toast", show);
    return () => { window.removeEventListener("airdrop-toast", show); timers.forEach(clearTimeout); };
  }, []);
  return createPortal(<div className="toast-stack" aria-live="polite">{items.map(item => <div className="toast" role="alert" key={item.id}>
    <AlertCircle size={18} /><span>{item.message}</span>
    <button aria-label="Dismiss notification" onClick={() => setItems(all => all.filter(value => value.id !== item.id))}><X size={16} /></button>
  </div>)}</div>, container);
}
