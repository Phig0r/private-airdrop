import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ChevronRight, Fingerprint, Search } from "lucide-react";
import { Badge } from "./ui";
import { phaseLabel, statusTone } from "../services";

export default function AirdropBrowser({
  airdrops,
  selected,
  onSelect,
  busy,
  admin = false,
}) {
  const activeTransition = useRef(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const matches = (item, status = filter, text = query) =>
    item.name.toLowerCase().includes(text.toLowerCase()) &&
    (status === "All" || item.status === status.toUpperCase());
  const shown = airdrops.filter((item) => matches(item));
  const update = (action, animate = false) => {
    activeTransition.current?.skipTransition();
    activeTransition.current = null;
    if (animate && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const transition = document.startViewTransition(() => flushSync(action));
      activeTransition.current = transition;
      transition.finished.finally(() => {
        if (activeTransition.current === transition) activeTransition.current = null;
      });
    } else action();
  };
  // Animate only the grid/detail layout change, never cards within the scrollport.
  const select = key => update(() => onSelect(key), Boolean(selected) !== Boolean(key));
  return (
    <aside className="browser-panel" style={{ viewTransitionName: admin ? "admin-browser" : "user-browser" }}>
      <div className="browser-top">
        {selected ? (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => select(null)}
          >
            <ArrowLeft size={15} />
            All airdrops
          </button>
        ) : (
          <h1>{admin ? "Manage airdrops" : "Airdrops"}</h1>
        )}
        <span>{shown.length} airdrops</span>
      </div>
      <label className="search-field">
        <Search size={15} />
        <input
          aria-label="Search airdrops"
          placeholder="Search airdrops"
          value={query}
          disabled={busy}
          onChange={(e) => update(() => setQuery(e.target.value))}
        />
      </label>
      <nav className="status-filters" aria-label="Filter airdrops">
        {["All", "Active", "Paused", "Completed", "Ended"].map((status) => (
          <button
            key={status}
            aria-pressed={filter === status}
            disabled={busy}
            onClick={() => update(() => setFilter(status))}
          >
            {status}
          </button>
        ))}
      </nav>
      <div
        className={
          admin ? "management-list browser-cards" : "airdrop-list browser-cards"
        }
      >
        {shown.map((item) => (
          <button
            key={item.key}
            className={`${admin ? "managed-drop" : "airdrop-option"} ${selected === item.key ? "selected" : ""}`}
            disabled={busy}
            onClick={() => select(item.key)}
          >
            <div className="airdrop-option-title">
              <Fingerprint size={24} strokeWidth={1.3} />
              <strong>{item.name}</strong>
              <ChevronRight size={15} />
            </div>
            <div className="airdrop-badges">
              <Badge>{phaseLabel(item)}</Badge>
              <Badge tone={statusTone(item)}>{item.status}</Badge>
            </div>
          </button>
        ))}
      </div>
      {!shown.length && (
        <p className="browser-empty">No airdrops match this filter.</p>
      )}
    </aside>
  );
}
