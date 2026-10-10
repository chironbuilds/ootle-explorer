import { useState } from "react";
import { Card, PageHeader, SectionLabel } from "../components/ui";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const ORIGIN = "https://explorer.tari.mw";

function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_400);
    } catch {
      // Clipboard blocked -- the snippet is still selectable on screen.
    }
  };
  return (
    <div className="border-b border-border-soft px-5 py-4 last:border-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</span>
        <button onClick={copy} className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-ink-dim transition-colors hover:border-accent-dim hover:text-ink">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs text-ink-dim">{code}</pre>
    </div>
  );
}

export default function BadgePage() {
  useDocumentTitle("Verified badge");
  const link = `${ORIGIN}/templates`;
  const dark = `${ORIGIN}/badge/verified-on-veil.svg`;
  const light = `${ORIGIN}/badge/verified-on-veil-light.svg`;

  return (
    <div>
      <PageHeader title="Verified on Veil" sub="A badge for Ootle projects that Veil has verified" />

      <Card className="mb-8 px-5 py-6">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <p className="mb-2 text-xs text-ink-faint">Dark</p>
            <img src="/badge/verified-on-veil.svg" alt="Verified on Veil" width={176} height={32} />
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="mb-2 text-xs text-neutral-500">Light</p>
            <img src="/badge/verified-on-veil-light.svg" alt="Verified on Veil" width={176} height={32} />
          </div>
        </div>
      </Card>

      <SectionLabel>Embed it</SectionLabel>
      <Card className="mb-8">
        <Snippet label="HTML (dark)" code={`<a href="${link}"><img src="${dark}" alt="Verified on Veil" width="176" height="32"></a>`} />
        <Snippet label="HTML (light)" code={`<a href="${link}"><img src="${light}" alt="Verified on Veil" width="176" height="32"></a>`} />
        <Snippet label="Markdown" code={`[![Verified on Veil](${dark})](${link})`} />
      </Card>

      <SectionLabel>What it means</SectionLabel>
      <Card className="px-5 py-4 text-sm leading-relaxed text-ink-dim">
        <p>
          The blue tick appears next to a template or component on Veil when it is on Veil's verified list: it's a label Veil curates, not something a
          project can add to itself. The badge is for projects that are on that list. It says Veil recognises the project; it isn't an audit and
          doesn't vouch for what the code does.
        </p>
        <p className="mt-3">
          To get a project verified, open an issue or pull request on the{" "}
          <a href="https://github.com/chironbuilds/ootle-explorer" className="text-accent hover:text-accent-strong" target="_blank" rel="noreferrer">
            Veil repository
          </a>{" "}
          with the template address, the project's name and a link to its source. Only add the badge once your project shows the tick on Veil.
        </p>
      </Card>
    </div>
  );
}
