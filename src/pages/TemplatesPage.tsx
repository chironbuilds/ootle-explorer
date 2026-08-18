import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCachedTemplates } from "../lib/indexer";
import { Card, ErrorBlock, LoadingBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { Pagination } from "../components/Pagination";

// The indexer caps `limit` at 100 server-side; there are well under 100 cached templates today,
// so one fetch at the max gets the complete set to paginate over client-side.
const FETCH_LIMIT = 100;
const PAGE_SIZE = 20;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TemplatesPage() {
  // The indexer's `templates/cached` route only accepts `limit` -- no cursor or offset -- so
  // there's no server-side page to ask for. Pagination here is client-side over one larger fetch.
  const query = useQuery({ queryKey: ["templates"], queryFn: () => listCachedTemplates(FETCH_LIMIT) });
  const [page, setPage] = useState(0);

  const all = query.data?.templates ?? [];
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const visible = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Templates" sub="WASM templates cached by this indexer node" />

      {query.isLoading && <LoadingBlock label="Loading templates…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Name</span>
            <span>Address</span>
            <span>Size</span>
            <span>Epoch</span>
          </div>
          {visible.map((t) => (
            <div
              key={t.address}
              className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto_auto] sm:items-center sm:gap-3"
            >
              <span className="font-medium text-ink">{t.name}</span>
              <Hash value={t.address} link={false} />
              <span className="tabular text-xs text-ink-faint">{formatBytes(t.code_size)}</span>
              <span className="tabular text-xs text-ink-faint">{t.epoch}</span>
            </div>
          ))}
          <Pagination
            page={page + 1}
            pageCount={pageCount}
            canPrev={page > 0}
            canNext={page < pageCount - 1}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </Card>
      )}
    </div>
  );
}
