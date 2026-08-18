import { useQuery } from "@tanstack/react-query";
import { listValidators } from "../lib/indexer";
import { Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { Disclosure } from "../components/Disclosure";

export default function ValidatorsPage() {
  const query = useQuery({ queryKey: ["validators"], queryFn: () => listValidators(100) });

  return (
    <div>
      <PageHeader title="Validators" sub={query.data ? `Active at epoch ${query.data.epoch.toLocaleString()}` : "Active validator set"} />

      {query.isLoading && <LoadingBlock label="Loading validators…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2fr)_140px_120px_110px] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Public key</span>
            <span>Shard group</span>
            <span>Since epoch</span>
            <span className="text-right">Vote power</span>
          </div>
          {query.data.validators.map((v) => (
            <Disclosure
              key={v.public_key}
              className="border-b border-border-soft last:border-0"
              summary={
                <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,2fr)_140px_120px_110px] sm:items-center sm:gap-3">
                  <Hash value={v.public_key} link={false} />
                  <span className="tabular text-xs text-ink-dim">
                    {v.shard_group.start}–{v.shard_group.end_inclusive}
                  </span>
                  <span className="tabular text-xs text-ink-faint">{v.start_epoch}</span>
                  <span className="tabular text-right text-xs text-ink-dim">{v.vote_power}</span>
                </div>
              }
            >
              <div className="rounded-lg border border-border-soft">
                <KeyValueRow label="Peer ID">
                  <span className="font-mono text-xs text-ink">{v.peer_id}</span>
                </KeyValueRow>
                <KeyValueRow label="Fee claim public key">
                  <Hash value={v.fee_claim_public_key} link={false} />
                </KeyValueRow>
                <KeyValueRow label="Active until">{v.end_epoch === null ? "still active" : `epoch ${v.end_epoch}`}</KeyValueRow>
              </div>
            </Disclosure>
          ))}
        </Card>
      )}
    </div>
  );
}
