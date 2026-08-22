import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { linkForId } from "../lib/links";
import { componentAddressFromOtlAddress } from "../lib/ootleAddress";

const RECENTS_KEY = "veil-palette-recents";
const MAX_RECENTS = 5;

interface PaletteItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  target: string;
}

function loadRecents(): PaletteItem[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as PaletteItem[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: PaletteItem) {
  try {
    const next = [item, ...loadRecents().filter((r) => r.target !== item.target)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable -- recents are a nicety, not a requirement.
  }
}

const PAGE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.5 6h11" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const HASH_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M5.5 2.5l-1.5 11M12 2.5l-1.5 11M3 5.5h11M2 10.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const PAGES: PaletteItem[] = [
  { id: "page-home", icon: PAGE_ICON, label: "Overview", hint: "live transactions & network stats", target: "/" },
  { id: "page-events", icon: PAGE_ICON, label: "Events", hint: "on-chain event feed", target: "/events" },
  { id: "page-templates", icon: PAGE_ICON, label: "Templates", hint: "WASM templates", target: "/templates" },
  { id: "page-validators", icon: PAGE_ICON, label: "Validators", hint: "consensus set & fee pools", target: "/validators" },
  { id: "page-l1supply", icon: PAGE_ICON, label: "L1 Supply", hint: "layer 1 bridge supply", target: "/l1-supply" },
];

/** Resolves free text to a concrete destination item, or null if it isn't any recognizable shape. */
function resolveTarget(text: string): PaletteItem | null {
  const trimmed = text.trim();
  const substateLink = linkForId(trimmed);
  if (substateLink && /^[0-9a-f]{64}$/i.test(trimmed)) {
    return { id: "resolved-tx", icon: HASH_ICON, label: "Go to transaction", hint: trimmed, target: substateLink };
  }
  if (substateLink) {
    return { id: "resolved-substate", icon: HASH_ICON, label: "Go to substate", hint: trimmed, target: substateLink };
  }
  const componentAddress = componentAddressFromOtlAddress(trimmed);
  if (componentAddress) {
    return {
      id: "resolved-account",
      icon: HASH_ICON,
      label: "Go to account",
      hint: `${trimmed} → ${componentAddress}`,
      target: `/substate/${componentAddress}`,
    };
  }
  return null;
}

/** The command palette. Mounted only while open (Layout toggles it with Ctrl/Cmd+K or "/"), so
 * state resets naturally on each mount and the input can autofocus without effect gymnastics. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const recents = useMemo(
    () => loadRecents(),
    // Loaded once per mount -- the palette remounts on every open, so this is always current.
    [],
  );
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const go = useCallback(
    (item: PaletteItem) => {
      saveRecent(item);
      onClose();
      navigate(item.target);
    },
    [navigate, onClose],
  );

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recents.length > 0 ? [...recents, ...PAGES.filter((p) => !recents.some((r) => r.id === p.id))] : PAGES;
    const resolved = resolveTarget(query);
    const pageMatches = PAGES.filter((p) => p.label.toLowerCase().includes(q) || (p.hint ?? "").toLowerCase().includes(q));
    return resolved ? [resolved, ...pageMatches] : pageMatches;
  }, [query, recents]);

  // Clamp instead of resetting via effect: deleting characters shrinks the list under the cursor.
  const activeIndex = Math.min(highlighted, Math.max(items.length - 1, 0));

  // Keep the highlighted row in view during arrow-key navigation.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[14vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/40 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border-soft px-4">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0 text-ink-faint">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlighted(Math.min(activeIndex + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlighted(Math.max(activeIndex - 1, 0));
              } else if (e.key === "Enter" && items[activeIndex]) {
                e.preventDefault();
                go(items[activeIndex]);
              }
            }}
            placeholder="Search pages, or paste a transaction / substate / otl_… address…"
            spellCheck={false}
            className="w-full bg-transparent py-3.5 font-mono text-sm text-ink placeholder:font-body placeholder:text-ink-faint outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-faint">Nothing matches “{query.trim()}” — try a full transaction id, substate address, or otl_… wallet address.</p>
          ) : (
            <>
              {!query.trim() && recents.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-ink-faint">Recent</p>}
              {items.map((item, i) => (
                <button
                  key={`${item.id}-${item.target}`}
                  data-index={i}
                  onClick={() => go(item)}
                  onMouseMove={() => setHighlighted(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${i === activeIndex ? "bg-accent-wash" : ""}`}
                >
                  <span className={`shrink-0 ${i === activeIndex ? "text-accent" : "text-ink-faint"}`}>{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${i === activeIndex ? "text-ink" : "text-ink-dim"}`}>{item.label}</span>
                    {item.hint && <span className="block truncate font-mono text-xs text-ink-faint">{item.hint}</span>}
                  </span>
                  {i === activeIndex && (
                    <kbd className="hidden shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">↵</kbd>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border-soft px-4 py-2.5 text-[11px] text-ink-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">esc close</span>
        </div>
      </div>
    </div>
  );
}
