import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { linkForId } from "../lib/links";

export function SearchBar({ className = "" }: { className?: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = linkForId(trimmed);
    if (target) {
      setError(false);
      setValue("");
      navigate(target);
    } else {
      setError(true);
    }
  };

  return (
    <form onSubmit={submit} className={`relative ${className}`}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        placeholder="Search transaction id or substate address…"
        spellCheck={false}
        className={`w-full rounded-lg border bg-surface py-2.5 pl-10 pr-4 font-mono text-sm text-ink placeholder:font-body placeholder:text-ink-faint outline-none transition-colors focus:border-accent-dim ${
          error ? "border-danger" : "border-border"
        }`}
      />
      {error && <p className="absolute left-0 top-full mt-1.5 text-xs text-danger">Not a transaction id or substate address.</p>}
    </form>
  );
}
