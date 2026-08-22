import { TOPIC_LABEL } from "../lib/topics";

/** Colored chip for an event topic -- known std.* topics get friendly names/tints, custom
 * template-emitted topics render verbatim in the accent tint. Shared by the global events feed
 * and per-resource activity lists so the same event reads identically everywhere. */
export function TopicBadge({ topic }: { topic: string }) {
  const known = TOPIC_LABEL[topic];
  const tone =
    known?.tone === "success" ? "text-success bg-success/10" : known?.tone === "danger" ? "text-danger bg-danger/10" : "text-accent bg-accent/10";
  return (
    <span title={known ? topic : undefined} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {known?.label ?? topic}
    </span>
  );
}
