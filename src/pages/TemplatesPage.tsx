import { useQuery } from "@tanstack/react-query";
import { listCachedTemplates } from "../lib/indexer";
import { Card, ErrorBlock, LoadingBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TemplatesPage() {
  const query = useQuery({ queryKey: ["templates"], queryFn: () => listCachedTemplates(100) });

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
          {query.data.templates.map((t) => (
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
        </Card>
      )}
    </div>
  );
}
