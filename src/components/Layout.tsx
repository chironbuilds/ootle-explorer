import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getIdentity, getNetworkInfo } from "../lib/indexer";
import { SearchBar } from "./SearchBar";
import { Hash } from "./Hash";
import { ErrorBoundary } from "./ErrorBoundary";

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" className="shrink-0">
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="2.6 3.2" />
      <circle cx="18.5" cy="15" r="5.5" fill="var(--reveal)" />
    </svg>
  );
}

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/templates", label: "Templates" },
  { to: "/validators", label: "Validators" },
];

function NetworkPill() {
  const { data, isError } = useQuery({
    queryKey: ["network"],
    queryFn: getNetworkInfo,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  return (
    <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs sm:flex">
      <span className={`h-1.5 w-1.5 rounded-full ${isError ? "bg-danger" : "bg-success"}`} />
      <span className="font-medium text-ink-dim">{data?.network ?? (isError ? "offline" : "connecting…")}</span>
      {data && (
        <>
          <span className="text-border">·</span>
          <span className="tabular text-ink-faint">
            epoch <span className="text-ink">{data.epoch.toLocaleString()}</span>
          </span>
        </>
      )}
    </div>
  );
}

function NodeIdentity() {
  const { data } = useQuery({ queryKey: ["identity"], queryFn: getIdentity, staleTime: 60_000 });
  if (!data) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      <span>Indexer peer id</span>
      <Hash value={data.peer_id} link={false} className="text-ink-dim" />
      {data.public_addresses[0] && <span className="text-ink-dim">· {data.public_addresses[0]}</span>}
    </p>
  );
}

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ground">
      <header className="sticky top-0 z-20 border-b border-border-soft bg-ground/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[1.15rem] font-semibold tracking-tight text-ink">Veil</span>
            <span className="hidden font-body text-xs text-ink-faint sm:inline">Ootle Explorer</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-surface-2 text-ink" : "text-ink-dim hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <SearchBar className="w-56 lg:w-80" />
            <NetworkPill />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border-soft px-5 py-2 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `shrink-0 rounded-md px-3 py-1 text-sm font-medium ${isActive ? "bg-surface-2 text-ink" : "text-ink-dim"}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-ink-faint">
        <p>
          Veil reads live from the public Ootle indexer at{" "}
          <a href="https://ootle-indexer-a.tari.com" className="text-ink-dim hover:text-accent" target="_blank" rel="noreferrer">
            ootle-indexer-a.tari.com
          </a>
          . Independent, unofficial project.
        </p>
        <NodeIdentity />
      </footer>
    </div>
  );
}
