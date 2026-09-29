import { toast } from "./Toasts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { short } from "../services";

export function Button({
  children,
  secondary,
  busy,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button ${secondary ? "secondary" : ""} ${className}`}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({ children, tone = "" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Field({ label, note, error, children, ...props }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children || <input aria-invalid={!!error} {...props} />}
      {note && <span className="field-note">{note}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
export function ExpandingInput({ label, value, animate = false, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    let previousWidth = -1;
    let frame;
    const resize = () => {
      if (element.clientWidth === previousWidth) return;
      previousWidth = element.clientWidth;
      const previousHeight = element.getBoundingClientRect().height;
      if (animate) element.style.transition = "none";
      element.style.height = "auto";
      const height = element.scrollHeight + element.offsetHeight - element.clientHeight;
      if (animate) {
        element.style.height = `${previousHeight}px`;
        void element.offsetHeight;
        element.style.transition = "";
      }
      element.style.height = `${height}px`;
    };
    resize();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value, animate]);
  return (
    <textarea
      ref={ref}
      className="signature-content"
      aria-label={label}
      value={value}
      readOnly
      rows={1}
      {...props}
    />
  );
}
export function Notice({ children, neutral = false }) {
  useEffect(() => { if (children && !neutral) toast(children); }, [children, neutral]);
  return children && neutral ? (
    <div
      className={`notice ${neutral ? "neutral" : ""}`}
      role={neutral ? "status" : "alert"}
    >
      {neutral ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
      <span>{children}</span>
    </div>
  ) : null;
}
export function SecretField({ label, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={props.id}>
        {label}
      </label>
      <div className="secret-input">
        <input {...props} type={visible ? "text" : "password"} />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
export function HashValue({ label, value, full = false }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(full);
  const [error, setError] = useState("");
  return (
    <div className="hash-value">
      <div className="hash-caption">
        {label}
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Collapse" : "View full"}
        </button>
      </div>
      <div>
        <code className={expanded ? "expanded" : ""}>
          {expanded ? value : short(value)}
        </code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setExpanded(true);
              setError("Copy unavailable. Select the full value to copy it.");
            }
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {error && <span className="muted small">{error}</span>}
    </div>
  );
}
export function Progress({ text }) {
  return text ? (
    <div className="progress-note" role="status">
      <LoaderCircle size={15} className="spin" />
      {text}
    </div>
  ) : null;
}
