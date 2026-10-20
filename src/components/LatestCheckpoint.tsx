import { useMutation, useQuery } from "@tanstack/react-query";
import { getLatestEpochCheckpoint } from "../lib/indexer";
import { Card, SectionLabel, Badge } from "./ui";
import { Hash } from "./Hash";
import { verifyEpochCheckpoint } from "../lib/verifyProof";

/** "Committee-verified" is a claim -- this shows the receipt. A checkpoint only commits once a
 * threshold of validators sign a quorum certificate accepting it (TIP consensus, mirrored here
 * from the indexer's own `/epoch-checkpoints/latest`); listing which validators actually signed
 * turns the badge shown elsewhere in the app from an assertion into something checkable against
 * the same validator set shown on the Validators page. */
export function LatestCheckpoint() {
  const query = useQuery({ queryKey: ["epoch-checkpoint-latest"], queryFn: getLatestEpochCheckpoint, refetchInterval: 30_000 });
  const header = query.data?.checkpoint.proof?.V1?.commit_proof.header;
  const elements = query.data?.checkpoint.proof?.V1?.commit_proof.proof_elements ?? [];

  const verify = useMutation({
    mutationFn: () => verifyEpochCheckpoint(query.data!.checkpoint, header!),
  });

  if (!header) return null;

  const signers = [
    ...new Map(
      elements
        .filter((e) => e.QuorumCertificate?.decision === "Accept")
        .flatMap((e) => e.QuorumCertificate!.signatures)
        .map((s) => [s.public_key, s] as const),
    ).values(),
  ];

  return (
    <div className="mb-8">
      <SectionLabel>Latest checkpoint</SectionLabel>
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-ink-dim">
            Epoch <span className="tabular text-ink">{header.epoch.toLocaleString()}</span>
          </span>
          <span className="text-ink-dim">
            Height <span className="tabular text-ink">{header.height.toLocaleString()}</span>
          </span>
          <span className="flex items-center gap-1.5 text-ink-dim">
            State root <Hash value={header.state_merkle_root} link={false} className="text-xs" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => verify.mutate()}
            disabled={verify.isPending}
            className="rounded-lg border border-accent-dim bg-accent-wash px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-strong disabled:opacity-60"
          >
            {verify.isPending ? "Verifying…" : verify.data ? "Verify again" : "Verify checkpoint"}
          </button>
          {verify.data && (
            <span className={`text-xs ${verify.data.ok ? "text-success" : "text-danger"}`}>
              {verify.data.ok
                ? `✓ Verified in your browser: ${verify.data.quorumThreshold}+ of ${verify.data.committeeSize} committee members signed, and the shard roots match the signed state root.`
                : `✗ Did not verify: ${verify.data.error ?? "unknown error"}`}
            </span>
          )}
          {verify.isError && <span className="text-xs text-danger">Could not run the check: {(verify.error as Error).message}</span>}
        </div>
        {signers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Signed by</span>
            {signers.map((s) => (
              <span key={s.public_key} className="flex items-center gap-1.5">
                <Badge tone="reveal">Accept</Badge>
                <Hash value={s.public_key} link={false} className="text-xs" />
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
