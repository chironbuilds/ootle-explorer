import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="font-display text-4xl font-semibold text-ink-faint">404</p>
      <p className="text-sm text-ink-dim">This page doesn't exist.</p>
      <Link to="/" className="mt-2 text-sm font-medium text-accent hover:text-accent-strong">
        Back to overview
      </Link>
    </div>
  );
}
