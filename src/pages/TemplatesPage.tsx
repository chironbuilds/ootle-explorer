import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { listCachedTemplates } from "../lib/indexer";
import { Card, ErrorBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { KnownAddressBadge } from "../components/KnownAddressBadge";
import { Pagination } from "../components/Pagination";
import { TableRowsSkeleton } from "../components/Skeleton";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const PAGE_SIZE = 20;

type SortKey = "epoch-desc" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "epoch-desc", label: "Newest first" },
  { key: "name", label: "Name A–Z" },
];

export default function TemplatesPage() {
  useDocumentTitle("Templates");
  // The catalogue is cursor-paginated server-side, but there are well under 100 templates today,
  // so one fetch at the cap gets the complete set to filter/sort/paginate over client-side.
  const query = useQuery({ queryKey: ["templates"], queryFn: () => listCachedTemplates() });
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SortKey>("epoch-desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const all = query.data?.entries ?? [];
    const q = search.trim().toLowerCase();
    const matches = q
      ? all.filter((t) => t.template_name.toLowerCase().includes(q) || t.template_address.toLowerCase().includes(q))
      : all;
    const sorted = [...matches];
    if (sort === "name") sorted.sort((a, b) => a.template_name.localeCompare(b.template_name));
    else sorted.sort((a, b) => b.at_epoch - a.at_epoch);
    return sorted;
  }, [query.data, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Templates"
        sub="WASM templates discovered on the network"
        actions={
          query.data ? (
            <span className="tabular text-xs text-ink-faint">
              {filtered.length} of {query.data.entries.length}
            </span>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by name or address…"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent-dim"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey);
            setPage(0);
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-dim outline-none transition-colors focus:border-accent-dim"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading && <TableRowsSkeleton rows={10} cols={3} />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_70px] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Name</span>
            <span>Address</span>
            <span>Epoch</span>
          </div>
          {visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">No templates match “{search.trim()}”.</p>
          ) : (
            visible.map((t) => (
              <Link
                key={t.template_address}
                to={`/template/${t.template_address}`}
                className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_70px] sm:items-center sm:gap-3"
              >
                <span className="flex items-center gap-2 font-medium text-ink">
                  {t.template_name}
                  <KnownAddressBadge address={t.template_address} />
                </span>
                <Hash value={t.template_address} link={false} />
                <span className="tabular text-xs text-ink-faint">{t.at_epoch}</span>
              </Link>
            ))
          )}
          <Pagination
            page={safePage + 1}
            pageCount={pageCount}
            canPrev={safePage > 0}
            canNext={safePage < pageCount - 1}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </Card>
      )}
    </div>
  );
}
