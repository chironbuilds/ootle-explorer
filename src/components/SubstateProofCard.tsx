import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSubstateWithProof } from "../lib/indexer";
import { Card, ErrorBlock, KeyValueRow, SectionLabel, Spinner } from "./ui";
import { Hash } from "./Hash";

function byteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/** Inclusion proof for a committee-verified substate. Fetched on demand (the proof is a few KB of
 * extra payload per request) and shown as the anchor it commits to -- the block, state root and
 * shard group -- with the raw blobs downloadable for an independent verifier. This page doesn't
 * re-verify the proof itself: that needs the committee for the anchor's epoch, so the card says
 * what the indexer vouches for rather than implying more. */
export function SubstateProofCard({ id }: { id: string }) {
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: ["substate-proof", id],
    queryFn: () => getSubstateWithProof(id),
    enabled: requested,
    retry: false,
    staleTime: 60_000,
  });
  const proof = query.data?.proof;

  const download = () => {
    if (!proof) return;
    const blob = new Blob([JSON.stringify({ substate_id: id, version: query.data?.version, proof }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-proof.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-8">
      <SectionLabel>Proof of inclusion</SectionLabel>
      {!requested ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="max-w-xl text-sm text-ink-dim">
            This value was checked against the committee. Load the merkle proof that ties it to a block the committee committed.
          </p>
          <button
            onClick={() => setRequested(true)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-dim transition-colors hover:border-accent-dim hover:text-ink"
          >
            Show proof
          </button>
        </Card>
      ) : query.isLoading ? (
        <Card className="flex items-center gap-3 px-5 py-4 text-sm text-ink-dim">
          <Spinner /> Fetching the proof from the committee…
        </Card>
      ) : query.isError ? (
        <ErrorBlock message={(query.error as Error).message} />
      ) : !proof ? (
        <Card className="px-5 py-4 text-sm text-ink-dim">
          No proof was returned: no committee member could supply one for this substate yet (e.g. nothing has been committed since an epoch change).
        </Card>
      ) : (
        <Card>
          <KeyValueRow label="Anchor epoch">{proof.anchor.epoch}</KeyValueRow>
          <KeyValueRow label="Anchor height">{proof.anchor.height}</KeyValueRow>
          <KeyValueRow label="Shard group">
            {proof.anchor.shard_group.start}–{proof.anchor.shard_group.end_inclusive}
          </KeyValueRow>
          <KeyValueRow label="Anchor block">
            <Hash value={proof.anchor.block_id} link={false} />
          </KeyValueRow>
          <KeyValueRow label="State merkle root">
            <Hash value={proof.anchor.state_merkle_root} link={false} />
          </KeyValueRow>
          <KeyValueRow label="Value hash epoch">{proof.value_hash_epoch}</KeyValueRow>
          <KeyValueRow label="Proof size">
            commit {formatBytes(byteLength(proof.commit_proof))} · value {formatBytes(byteLength(proof.value_proof))}
          </KeyValueRow>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-5 py-3.5">
            <p className="max-w-xl text-xs text-ink-faint">
              Shows the value was committed at this block; it says nothing about later changes. Verifying it independently needs the committee for
              epoch {proof.anchor.epoch}. The indexer already did this check.
            </p>
            <button
              onClick={download}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-dim transition-colors hover:border-accent-dim hover:text-ink"
            >
              Download proof (JSON)
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
