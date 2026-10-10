import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getTemplate, listCachedTemplates } from "../lib/indexer";
import { formatArgType } from "../lib/templateAbi";
import { Badge, Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader, SectionLabel } from "../components/ui";
import { Hash } from "../components/Hash";
import { KnownAddressBadge } from "../components/KnownAddressBadge";
import { ShareButton } from "../components/ShareButton";
import { useDocumentTitle } from "../lib/useDocumentTitle";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function TemplatePage() {
  const { address = "" } = useParams();

  const detail = useQuery({ queryKey: ["template", address], queryFn: () => getTemplate(address), enabled: !!address });
  useDocumentTitle(detail.data?.name ? `Template ${detail.data.name}` : undefined);
  // The detail endpoint only returns the ABI (name + definition + code_size); author/binary-hash/
  // epoch only exist in the catalogue, so it's fetched and joined here. Shares the list page's
  // query cache under the same key, so visiting from that list costs no extra request.
  const catalogue = useQuery({ queryKey: ["templates"], queryFn: () => listCachedTemplates() });
  const meta = catalogue.data?.entries.find((t) => t.template_address === address);

  const functions = detail.data?.definition?.V1?.functions ?? [];

  return (
    <div>
      <PageHeader
        title={detail.data?.name ?? <span className="font-mono text-xl">{address}</span>}
        sub="Template"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">WASM</Badge>
            <KnownAddressBadge address={address} />
            <ShareButton path={`/template/${address}`} />
          </div>
        }
      />

      {detail.isLoading && <LoadingBlock label="Loading template…" />}
      {detail.isError && <ErrorBlock message={(detail.error as Error).message} />}

      {detail.data && (
        <>
          <Card className="mb-8">
            <KeyValueRow label="Address">
              <Hash value={address} full />
            </KeyValueRow>
            <KeyValueRow label="Code size">{formatBytes(detail.data.code_size)}</KeyValueRow>
            {meta && (
              <>
                <KeyValueRow label="Author public key">
                  <Hash value={meta.author_public_key} />
                </KeyValueRow>
                <KeyValueRow label="Binary hash">
                  <Hash value={meta.binary_hash} />
                </KeyValueRow>
                <KeyValueRow label="Published at epoch">{meta.at_epoch}</KeyValueRow>
              </>
            )}
          </Card>

          <SectionLabel>Functions ({functions.length})</SectionLabel>
          <Card>
            {functions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-ink-dim">No callable functions found.</p>
            ) : (
              functions.map((f) => (
                <div key={f.name} className="border-b border-border-soft px-5 py-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={f.is_mut ? "veil" : "accent"}>{f.is_mut ? "mut" : "view"}</Badge>
                    <span className="font-mono text-sm font-medium text-ink">{f.name}</span>
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-ink-dim">
                    ({f.arguments.map((a) => `${a.name}: ${formatArgType(a.arg_type)}`).join(", ")}) → {formatArgType(f.output)}
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
