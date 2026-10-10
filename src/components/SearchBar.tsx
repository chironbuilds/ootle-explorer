import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getTemplate, getTransaction, listCachedTemplates } from "../lib/indexer";
import { KNOWN_ADDRESSES } from "../lib/knownAddresses";
import { linkForId } from "../lib/links";
import { componentAddressFromOtlAddress } from "../lib/ootleAddress";

export function SearchBar({ className = "" }: { className?: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const go = (target: string) => {
    setError(false);
    setValue("");
    navigate(target);
  };

  /** A bare 64-hex string is either a transaction id or a template address -- they're
   * indistinguishable by shape, so ask the indexer which it is rather than always assuming a tx. */
  const resolveHex = async (hex: string): Promise<string> => {
    try {
      await queryClient.fetchQuery({ queryKey: ["tx-exists", hex], queryFn: () => getTransaction(hex), staleTime: 60_000, retry: false });
      return `/tx/${hex}`;
    } catch {
      try {
        await getTemplate(hex);
        return `/template/${hex}`;
      } catch {
        return `/tx/${hex}`;
      }
    }
  };

  /** Free text: match a template by name (or a known label such as "TARI Faucet") -- one hit opens
   * it, several land on the Templates page prefiltered. */
  const resolveText = async (text: string): Promise<string | null> => {
    const q = text.toLowerCase();
    if (q.length < 2) return null;
    const known = Object.entries(KNOWN_ADDRESSES).filter(([, k]) => k.label.toLowerCase().includes(q));
    if (known.length === 1) {
      const [addr] = known[0];
      return /^[0-9a-f]{64}$/i.test(addr) ? `/template/${addr}` : `/substate/${addr}`;
    }
    try {
      const catalogue = await queryClient.fetchQuery({ queryKey: ["templates"], queryFn: () => listCachedTemplates(), staleTime: 60_000 });
      const hits = catalogue.entries.filter((t) => t.template_name.toLowerCase().includes(q));
      if (hits.length === 1) return `/template/${hits[0].template_address}`;
      if (hits.length > 1 || known.length > 1) return `/templates?q=${encodeURIComponent(text)}`;
    } catch {
      // Catalogue unavailable -- fall through to "not found".
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    // An otl_... wallet address isn't itself a substate id -- it's the input a search box
    // realistically sees, so it's resolved here (to the account it derives) rather than in
    // linkForId, which every hash rendered anywhere in raw JSON also runs through.
    const componentAddress = componentAddressFromOtlAddress(trimmed);
    let target = linkForId(trimmed) ?? (componentAddress ? `/substate/${componentAddress}` : null);
    if (!target) {
      setBusy(true);
      target = await resolveText(trimmed);
      setBusy(false);
    }
    if (target && /^\/tx\/[0-9a-f]{64}$/i.test(target)) {
      setBusy(true);
      target = await resolveHex(trimmed);
      setBusy(false);
    }
    if (target) go(target);
    else setError(true);
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
        placeholder="Search tx, substate, template, otl_…"
        spellCheck={false}
        className={`w-full rounded-lg border bg-surface py-2.5 pl-10 pr-4 font-mono text-sm text-ink placeholder:font-body placeholder:text-ink-faint outline-none transition-colors focus:border-accent-dim ${
          error ? "border-danger" : "border-border"
        }`}
      />
      {error && <p className="absolute left-0 top-full mt-1.5 text-xs text-danger">Nothing found. Try a transaction id, substate address, template name, or otl_… wallet address.</p>}
    </form>
  );
}
